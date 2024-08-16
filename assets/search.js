document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const content = document.getElementById('content');
  let allPosts = [];

  fetchAllPosts().then(posts => {
    allPosts = posts;
  }).catch(error => console.error('Error loading posts:', error));

  searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    if (query.length < 2) {
      showOriginalContent();
      return;
    }
    const results = allPosts.filter(post => 
      post.title.toLowerCase().includes(query) || 
      post.content.toLowerCase().includes(query)
    );

    displayResults(results, query);
  });

  function displayResults(results, query) {
    searchResults.innerHTML = '';
    if (results.length === 0) {
      searchResults.innerHTML = '<p>No results found.</p>';
    } else {
      results.forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.classList.add('search-result');
        
        const title = document.createElement('a');
        title.href = result.url;
        title.textContent = result.title;
        resultItem.appendChild(title);

        const snippets = getAllSnippets(result.content, query);
        snippets.forEach(snippet => {
          const snippetDiv = document.createElement('div');
          snippetDiv.classList.add('search-result-snippet');
          snippetDiv.innerHTML = snippet;
          resultItem.appendChild(snippetDiv);
        });

        searchResults.appendChild(resultItem);
      });
    }
    content.style.display = 'none';
    searchResults.style.display = 'block';
  }

  function showOriginalContent() {
    content.style.display = 'block';
    searchResults.style.display = 'none';
  }

  function getAllSnippets(content, query) {
    const snippets = [];
    const lowerContent = content.toLowerCase();
    const contextSize = 50; // Characters of context on each side
    let lastIndex = 0;

    while (true) {
      const index = lowerContent.indexOf(query, lastIndex);
      if (index === -1) break;

      const start = Math.max(0, index - contextSize);
      const end = Math.min(content.length, index + query.length + contextSize);
      let snippet = content.slice(start, end);

      // Highlight the query in the snippet
      const highlightedSnippet = snippet.replace(
        new RegExp(query, 'gi'),
        match => `<mark>${match}</mark>`
      );

      snippets.push('...' + highlightedSnippet + '...');
      lastIndex = index + query.length;
    }

    return snippets;
  }
});

async function fetchAllPosts() {
  try {
    // Fetch the post-list.json file
    const response = await fetch('assets/post-list.json');
    const postUrls = await response.json();

    // Fetch content for each blog post
    const posts = await Promise.all(postUrls.map(async url => {
      const postResponse = await fetch(url);
      const postHtml = await postResponse.text();
      const parser = new DOMParser();
      const postDoc = parser.parseFromString(postHtml, 'text/html');
      const content = postDoc.getElementById('content');

      // Remove the table of contents
      const toc = content.querySelector('#table-of-contents');
      if (toc) toc.remove();

      // Remove content with class "taglist"
      const taglist = content.querySelector('.taglist');
      if (taglist) taglist.remove();

      // Remove postamble
      const postamble = content.querySelector('#postamble');
      if (postamble) postamble.remove();

      return {
        url: url,
        title: content.querySelector('.post-title a').textContent,
        content: content.textContent
      };
    }));

    return posts;
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}