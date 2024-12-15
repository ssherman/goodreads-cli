#!/usr/bin/env node

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const cheerio = require('cheerio');

// Add plugins to puppeteer
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const BASE_URL = 'https://www.goodreads.com/book/show/';

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
 * Navigate to the book page and wait for initial content
 * @param {Page} page - Puppeteer page object
 * @param {string} goodreadsId - ID of the book to look up
 */
async function navigateToBookPage(page, goodreadsId) {
  const url = `${BASE_URL}${goodreadsId}`;
  
  await page.goto(url, { 
    waitUntil: ['load', 'networkidle0'],
    timeout: 30000 
  });

  await page.waitForSelector('.BookPageMetadataSection', { visible: true, timeout: 10000 });
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
}

/**
 * Handle the book details expansion if necessary
 * @param {Page} page - Puppeteer page object
 */
async function handleBookDetailsExpansion(page) {
  const [detailsButton] = await Promise.all([
    page.waitForSelector('button[aria-label="Book details and editions"]', { visible: true, timeout: 10000 })
      .catch(() => null),
    page.waitForSelector('.EditionDetails', { visible: true, timeout: 10000 })
      .catch(() => null)
  ]);

  if (detailsButton) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {}),
      detailsButton.click()
    ]);
    
    await page.waitForSelector('.EditionDetails', { visible: true, timeout: 10000 })
      .catch(() => {});
  }

  // Add new code to handle the "...more" button for genres
  const moreGenresButton = await page.waitForSelector('.BookPageMetadataSection__genres button[aria-label="Show all items in the list"]', { timeout: 5000 })
    .catch(() => null);

  if (moreGenresButton) {
    await moreGenresButton.click();
    // Wait a moment for new genres to load
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
  }

  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));
}

/**
 * Main function to look up a book by its Goodreads ID
 * @param {string} goodreadsId - ID of the book to look up
 * @returns {Promise<Object>} Book details
 */
async function lookupBook(goodreadsId) {
  const { browser, page } = await initializeBrowser();
  
  try {
    await navigateToBookPage(page, goodreadsId);
    await handleBookDetailsExpansion(page);
    
    const html = await page.content();
    return parseBookDetails(html);
  } finally {
    await browser.close();
  }
}

/**
 * Parse the book details from the page HTML
 * @param {string} html - HTML content of the page
 * @returns {Object} Parsed book details
 */
function parseBookDetails(html) {
  const $ = cheerio.load(html);
  const bookDetails = initializeBookDetailsObject();

  parseTitleAndSeries($, bookDetails);
  parseAuthors($, bookDetails);
  parseRatings($, bookDetails);
  parseGenres($, bookDetails);
  parseBasicDetails($, bookDetails);
  parseDescription($, bookDetails);
  parseCoverImage($, bookDetails);
  parseEditionDetails($, bookDetails);
  parseSettings($, bookDetails);

  return bookDetails;
}

/**
 * Initialize the book details object with empty values
 * @returns {Object} Empty book details object
 */
function initializeBookDetailsObject() {
  return {
    title: null,
    series: null,
    authors: [],
    rating: null,
    numberOfRatings: null,
    numberOfReviews: null,
    genres: [],
    settings: [],
    numberOfPages: null,
    firstPublished: null,
    description: null,
    coverImage: null,
    editionDetails: {
      format: null,
      published: null,
      isbn13: null,
      isbn10: null,
      asin: null,
      language: null
    }
  };
}

/**
 * Parse title and series information
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {Object} bookDetails - Book details object to update
 */
function parseTitleAndSeries($, bookDetails) {
  const titleSection = $('.BookPageTitleSection__title');
  const seriesElement = titleSection.find('h3.Text__italic a');
  if (seriesElement.length) {
    bookDetails.series = seriesElement.text().trim();
    bookDetails.title = titleSection.find('h1[data-testid="bookTitle"]').text().trim();
  } else {
    bookDetails.title = titleSection.text().trim();
  }
}

/**
 * Parse author information
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {Object} bookDetails - Book details object to update
 */
function parseAuthors($, bookDetails) {
  $('.ContributorLinksList .ContributorLink__name').each((i, el) => {
    const authorName = $(el).text().replace(/\s+/g, ' ').trim();
    bookDetails.authors.push(authorName);
  });
}

/**
 * Parse ratings and reviews information
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {Object} bookDetails - Book details object to update
 */
function parseRatings($, bookDetails) {
  bookDetails.rating = $('.RatingStatistics__rating').first().text().trim() || null;

  const ratingsAndReviews = $('.RatingStatistics__meta').first().text().trim();
  const ratingsMatch = ratingsAndReviews.match(/(\d+(?:,\d+)*)\s+ratings/);
  const reviewsMatch = ratingsAndReviews.match(/(\d+(?:,\d+)*)\s+reviews/);
  
  bookDetails.numberOfRatings = ratingsMatch ? ratingsMatch[1].replace(/,/g, '') : null;
  bookDetails.numberOfReviews = reviewsMatch ? reviewsMatch[1].replace(/,/g, '') : null;
}

/**
 * Parse genre information
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {Object} bookDetails - Book details object to update
 */
function parseGenres($, bookDetails) {
  $('.BookPageMetadataSection__genres .Button__labelItem').each((i, el) => {
    const genreName = $(el).text().trim();
    if (genreName !== '...show all') {
      bookDetails.genres.push(genreName);
    }
  });
}

/**
 * Parse basic book details like pages and publication date
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {Object} bookDetails - Book details object to update
 */
function parseBasicDetails($, bookDetails) {
  const pagesFormat = $('p[data-testid="pagesFormat"]').text().trim();
  const pagesMatch = pagesFormat.match(/(\d+)\s*pages/);
  if (pagesMatch) {
    bookDetails.numberOfPages = pagesMatch[1];
  }

  const publicationInfo = $('p[data-testid="publicationInfo"]').text().trim();
  const publishedMatch = publicationInfo.match(/First published\s+(.+)/);
  if (publishedMatch) {
    bookDetails.firstPublished = publishedMatch[1].trim();
  }
}

/**
 * Parse description information
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {Object} bookDetails - Book details object to update
 */
function parseDescription($, bookDetails) {
  const descriptionDiv = $('.BookPageMetadataSection__description');
  if (descriptionDiv.length) {
    // Get the text from the first div inside the description section
    const description = descriptionDiv.find('.TruncatedContent__text').first().text().trim();
    bookDetails.description = description || null;
  }
}

/**
 * Parse cover image URL
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {Object} bookDetails - Book details object to update
 */
function parseCoverImage($, bookDetails) {
  const coverImage = $('.BookCover__image img.ResponsiveImage').attr('src');
  bookDetails.coverImage = coverImage || null;
}

/**
 * Parse edition-specific details
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {Object} bookDetails - Book details object to update
 */
function parseEditionDetails($, bookDetails) {
  $('.DescListItem').each((i, el) => {
    const label = $(el).find('dt').text().trim().toLowerCase();
    const value = $(el).find('dd').text().trim();

    switch (label) {
      case 'format':
        bookDetails.editionDetails.format = value;
        break;
      case 'published':
        bookDetails.editionDetails.published = value;
        break;
      case 'isbn':
        const isbn13Match = value.match(/^(\d{13})/);
        const isbn10Match = value.match(/ISBN10:\s*(\d{10})/);
        if (isbn13Match) bookDetails.editionDetails.isbn13 = isbn13Match[1];
        if (isbn10Match) bookDetails.editionDetails.isbn10 = isbn10Match[1];
        break;
      case 'asin':
        bookDetails.editionDetails.asin = value.trim();
        break;
      case 'language':
        bookDetails.editionDetails.language = value;
        break;
    }
  });
}

/**
 * Parse settings information
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {Object} bookDetails - Book details object to update
 */
function parseSettings($, bookDetails) {
  const settingsContainer = $('.WorkDetails .DescListItem').filter((i, el) => 
    $(el).find('dt').text().trim() === 'Setting'
  );
  
  if (settingsContainer.length) {
    const settingsText = settingsContainer.find('.TruncatedContent__text').text().trim();
    // Split by commas, clean up each setting, and remove duplicates
    const settings = [...new Set(
      settingsText.split(',').map(setting => {
        return setting.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
      })
    )];
    bookDetails.settings = settings;
  }
}

// Main execution
const goodreadsId = process.argv[2];

if (!goodreadsId) {
  process.exit(1);
}

lookupBook(goodreadsId)
  .then(bookDetails => {
    console.log(JSON.stringify(bookDetails, null, 2));
  })
  .catch(error => {
    process.exit(1);
  });
