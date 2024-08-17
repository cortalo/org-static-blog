document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");
  const content = document.getElementById("content");
  let allPosts = [];

  fetchAllPosts()
    .then((posts) => {
      allPosts = posts;
    })
    .catch((error) => console.error("Error loading posts:", error));

  searchInput.addEventListener("input", function () {
    const query = this.value;
    if (query.length < 2) {
      showOriginalContent();
      return;
    }
    const results = allPosts.filter(
      (post) =>
        postContainsQuery(post.title, query) ||
        postContainsQuery(post.content, query),
    );

    displayResults(results, query);
  });

  function postContainsQuery(text, query) {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapedQuery, "i"); // case-insensitive
    return regex.test(text);
  }

  function displayResults(results, query) {
    searchResults.innerHTML = "";
    if (results.length === 0) {
      searchResults.innerHTML = "<p>No results found.</p>";
    } else {
      results.forEach((result) => {
        const resultItem = document.createElement("div");
        resultItem.classList.add("search-result");

        const title = document.createElement("a");
        title.href = result.url;
        title.innerHTML = highlightText(result.title, query);
        resultItem.appendChild(title);

        const snippets = getAllSnippets(result.content, query, result.headers);
        if (snippets.length > 0) {
          snippets.forEach((snippet) => {
            const snippetDiv = document.createElement("div");
            snippetDiv.classList.add("search-result-snippet");

            const snippetUrl = snippet.anchor
              ? `${result.url}#${snippet.anchor}`
              : result.url;
            snippetDiv.innerHTML = `<a href="${snippetUrl}" class="snippet-link">${snippet.text}</a>`;

            resultItem.appendChild(snippetDiv);
          });
        } else if (!title.innerHTML.includes("<mark>")) {
          return;
        }

        searchResults.appendChild(resultItem);
      });

      document.querySelectorAll(".snippet-link").forEach((link) => {
        link.addEventListener("click", function (e) {
          e.preventDefault();
          const url = this.getAttribute("href");
          // console.log("Navigating to:", url); // Debug log
          navigateToPost(url);
        });
      });
    }
    content.style.display = "none";
    searchResults.style.display = "block";
  }

  function highlightText(text, query) {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapedQuery, "gi");
    return text.replace(regex, (match) => `<mark>${match}</mark>`);
  }

  function showOriginalContent() {
    content.style.display = "block";
    searchResults.style.display = "none";
  }

  function getAllSnippets(content, query, headers) {
    const snippets = [];
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapedQuery, "gi");
    const contextSize = 30;

    let match;
    while ((match = regex.exec(content)) !== null) {
      const index = match.index;
      let start = Math.max(0, index - contextSize);
      let end = Math.min(content.length, index + query.length + contextSize);

      while (start > 0 && /\S/.test(content[start])) start--;
      while (end < content.length && /\S/.test(content[end])) end++;

      let snippet = content.slice(start, end).replace(/\s+/g, " ").trim();

      const highlightedSnippet = snippet.replace(
        new RegExp(escapedQuery, "gi"),
        (match) => `<mark>${match}</mark>`,
      );

      if (highlightedSnippet.includes("<mark>")) {
        const nearestHeader = findNearestHeader(index, headers);

        snippets.push({
          text:
            (start > 0 ? "..." : "") +
            highlightedSnippet +
            (end < content.length ? "..." : ""),
          anchor: nearestHeader ? nearestHeader.id : "",
        });
      }
      regex.lastIndex = index + query.length;
    }

    return snippets;
  }

  function findNearestHeader(queryIndex, headers) {
    return headers.reduce((nearest, current) => {
      if (
        current.index <= queryIndex &&
        (!nearest || current.index > nearest.index)
      ) {
        return current;
      }
      return nearest;
    }, null);
  }

  function navigateToPost(url) {
    const [baseUrl, anchor] = url.split("#");

    fetch(baseUrl)
      .then((response) => response.text())
      .then((html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const newContent = doc.getElementById("content");

        if (newContent) {
          document.getElementById("content").innerHTML = newContent.innerHTML;
          history.pushState(null, "", url);

          setTimeout(() => {
            if (anchor) {
              const element = document.getElementById(anchor);
              if (element) {
                element.scrollIntoView({ behavior: "smooth" });
              }
            }
          }, 100);

          document.getElementById("content").style.display = "block";
          document.getElementById("search-results").style.display = "none";
        }
      })
      .catch((error) => console.error("Error:", error));
  }

  async function fetchAllPosts() {
    try {
      // Fetch the post-list.json file
      const response = await fetch(
        "https://chenyo-17.github.io/org-static-blog/assets/post-list.json",
      );
      const postUrls = await response.json();

      // Fetch content for each blog post
      const posts = await Promise.all(
        postUrls.map(async (url) => {
          const postResponse = await fetch(url);
          const postHtml = await postResponse.text();
          const parser = new DOMParser();
          const postDoc = parser.parseFromString(postHtml, "text/html");
          const content = postDoc.getElementById("content");

          // Extract the title before modifying the content
          const title =
            content.querySelector(".post-title a")?.textContent.trim() || "";

          // Remove the table of contents
          const toc = content.querySelector("#table-of-contents");
          if (toc) toc.remove();

          // Remove content with class "taglist"
          const taglist = content.querySelector(".taglist");
          if (taglist) taglist.remove();

          // Remove postamble
          const postamble = content.querySelector("#postamble");
          if (postamble) postamble.remove();

          // Clean up the text content after removing unwanted elements
          const cleanContent = content.textContent.replace(/\s+/g, " ").trim();

          // Extract headers with their positions
          const headers = Array.from(
            content.querySelectorAll("h1, h2, h3, h4, h5, h6"),
          ).map((header, index) => {
            // Normalize header text: replace newlines with spaces and trim
            const headerText = header.textContent.replace(/\s+/g, " ").trim();
            let headerIndex = cleanContent.indexOf(headerText);

            if (headerIndex === -1) {
              console.warn(`Header not found: "${headerText}"`);
            }

            return {
              id: header.id || `generated-id-${index}`,
              index: headerIndex,
              text: headerText,
            };
          });

          return {
            url: url,
            title: title,
            content: cleanContent,
            headers: headers,
          };
        }),
      );

      return posts;
    } catch (error) {
      console.error("Error fetching posts:", error);
      return [];
    }
  }
});
