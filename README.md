# Goodreads CLI

A command-line interface for interacting with Goodreads. This tool provides two main functions:
- Search for books by title, author, or general terms
- Look up detailed information about a specific book using its Goodreads ID

## Requirements

- Node.js 18 or higher
- Google Chrome installed (used by Puppeteer)

## Installation

Install globally via npm:

```bash
npm install -g goodreads-cli
```

## Usage

### Searching for Books

The search command supports searching by title, author, or across all fields.

#### Basic search (searches all fields):

```bash
goodreads-search "The Great Gatsby Fitzgerald"
```

##### Search by title:

```bash
goodreads-search "The Great Gatsby" title
```

#### Search by author:

```bash
goodreads-search "Fitzgerald" author
```


#### Example Output
```json
[
  {
    "title": "Hell House",
    "authors": [
      "Richard Matheson"
    ],
    "detailsUrl": "https://www.goodreads.com/book/show/33547.Hell_House?from_search=true&from_srp=true&qid=vwyBMoKT4C&rank=1",
    "goodreadsId": "33547",
    "publishedYear": "1971",
    "averageRating": "3.73",
    "numberOfRatings": "55061"
  },
  {
    "title": "Summary & Study Guide Hell House by Richard Matheson",
    "authors": [
      "BookRags"
    ],
    "detailsUrl": "https://www.goodreads.com/book/show/20388946-summary-study-guide-hell-house-by-richard-matheson?from_search=true&from_srp=true&qid=vwyBMoKT4C&rank=2",
    "goodreadsId": "20388946",
    "publishedYear": "2011",
    "averageRating": "4.40",
    "numberOfRatings": "5"
  }
]
```

### Looking up Book Details

Once you have a Goodreads book ID (from a search or URL), you can look up detailed information about the book:

```bash
goodreads-lookup 1234567890
```

#### Example Output
```json
{
  "title": "Hell House",
  "series": null,
  "authors": [
    "Richard Matheson"
  ],
  "rating": "3.73",
  "numberOfRatings": "55061",
  "numberOfReviews": "4640",
  "genres": [
    "Horror",
    "Fiction",
    "Paranormal",
    "Classics",
    "Ghosts",
    "Mystery",
    "Audiobook"
  ],
  "numberOfPages": "301",
  "firstPublished": "January 1, 1971",
  "editionDetails": {
    "format": "301 pages, Hardcover",
    "published": "July 1, 2004 by Severn House",
    "isbn13": "9780727860996",
    "isbn10": "0727860992",
    "asin": "0727860992",
    "language": "English"
  }
}
```

## ⚠️ Disclaimer

This tool is a proof of concept for educational purposes only. Web scraping may be against Goodreads' terms of service. Please use the official Goodreads API for any production applications. This tool is not affiliated with or endorsed by Goodreads or Amazon.