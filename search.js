#!/usr/bin/env node

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const cheerio = require('cheerio');

// Add plugins to puppeteer
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const BASE_URL = 'https://www.goodreads.com/search';

/**
 * Initialize a new browser page with common settings
 * @returns {Promise<{browser: Browser, page: Page}>}
 */
async function initializeBrowser() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  return { browser, page };
}

/**
 * Build the search URL with the provided parameters
 * @param {string} query - Search query
 * @param {string} searchType - Type of search (e.g., 'books')
 * @param {string} searchField - Field to search in (e.g., 'title', 'author', 'all')
 * @returns {string} Complete search URL
 */
function buildSearchUrl(query, searchType, searchField) {
  const searchParams = new URLSearchParams({
    utf8: '✓',
    q: query,
    search_type: searchType,
  });

  if (searchField !== 'all') {
    searchParams.append('search[field]', searchField);
  }

  return `${BASE_URL}?${searchParams.toString()}`;
}

/**
 * Navigate to the search page and wait for results
 * @param {Page} page - Puppeteer page object
 * @param {string} url - Search URL
 * @param {string} query - Search query
 * @param {string} searchType - Type of search
 * @param {string} searchField - Field being searched
 */
async function navigateToSearchPage(page, url, query, searchType, searchField) {
  console.log(`Searching for "${query}" with type "${searchType}" and field "${searchField}" at ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.waitForSelector('tr[itemtype="http://schema.org/Book"]', { visible: true, timeout: 10000 });
}

/**
 * Main search function
 * @param {string} query - Search query
 * @param {string} searchType - Type of search (default: 'books')
 * @param {string} searchField - Field to search in (default: 'all')
 * @returns {Promise<Array>} Search results
 */
async function searchBook(query, searchType = 'books', searchField = 'all') {
  const { browser, page } = await initializeBrowser();
  
  try {
    const searchUrl = buildSearchUrl(query, searchType, searchField);
    await navigateToSearchPage(page, searchUrl, query, searchType, searchField);
    
    const html = await page.content();
    return parseSearchResults(html);
  } finally {
    await browser.close();
  }
}

/**
 * Parse the search results from the page HTML
 * @param {string} html - HTML content of the page
 * @returns {Array} Parsed search results
 */
function parseSearchResults(html) {
  const $ = cheerio.load(html);
  const results = [];

  $('tr[itemtype="http://schema.org/Book"]').each((index, element) => {
    const bookData = parseBookData($, element);
    results.push(bookData);
  });

  return results;
}

/**
 * Parse individual book data from a search result row
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {Element} element - Book row element
 * @returns {Object} Parsed book data
 */
function parseBookData($, element) {
  const $el = $(element);
  const book = initializeBookObject($el);

  parseAuthors($, $el, book);
  parsePublishedDate($, $el, book);
  parseRatings($, $el, book);

  return book;
}

/**
 * Initialize a book object with basic data
 * @param {Cheerio} $el - Cheerio element for the book row
 * @returns {Object} Initial book object
 */
function initializeBookObject($el) {
  const detailsUrl = 'https://www.goodreads.com' + $el.find('.bookTitle').attr('href');
  return {
    title: $el.find('.bookTitle span[itemprop="name"]').text().trim() || null,
    authors: [],
    detailsUrl: detailsUrl || null,
    goodreadsId: detailsUrl.match(/\/show\/(\d+)/)?.[1] || null,
    publishedYear: null,
    averageRating: null,
    numberOfRatings: null
  };
}

/**
 * Parse authors from a book row
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {Cheerio} $el - Book row element
 * @param {Object} book - Book object to update
 */
function parseAuthors($, $el, book) {
  $el.find('.authorName__container').each((i, authorElement) => {
    book.authors.push($(authorElement).find('span[itemprop="name"]').text().trim());
  });
}

/**
 * Parse published date from a book row
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {Cheerio} $el - Book row element
 * @param {Object} book - Book object to update
 */
function parsePublishedDate($, $el, book) {
  const greyText = $el.find('.greyText.smallText.uitext').text();
  const publishedMatch = greyText.match(/published\s+(\d{4})/);
  book.publishedYear = publishedMatch ? publishedMatch[1] : null;
}

/**
 * Parse ratings information from a book row
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {Cheerio} $el - Book row element
 * @param {Object} book - Book object to update
 */
function parseRatings($, $el, book) {
  const ratingText = $el.find('.minirating').text();
  const ratingMatch = ratingText.match(/([\d.]+)\s+avg rating/);
  book.averageRating = ratingMatch ? ratingMatch[1] : null;
  
  const ratingsMatch = ratingText.match(/—\s+([\d,]+)\s+ratings/);
  book.numberOfRatings = ratingsMatch ? ratingsMatch[1].replace(/,/g, '') : null;
}

// Main execution
const query = process.argv[2];
const searchType = process.argv[3] || 'books';
const searchField = process.argv[4] || 'all';

if (!query) {
  console.error('Please provide a search query.');
  process.exit(1);
}

searchBook(query, searchType, searchField)
  .then(results => {
    console.log(JSON.stringify(results, null, 2));
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
