# Intro

A lightweight node spider. Supports:

1. FollowLink
1. Csutom headers
1. Bloom filter
1. Retry mechanism
1. Proxy Request
1. Routing
1. Crawling from last visited link
1. Free use of parser and memory

# Usage

```ts
import { Crawler, userAgent } from 'ngrab'
import cheerio from 'cheerio'

// init
let crawler = new Crawler({
    // required && unique
    name: 'myCrawler',
    // enable bloom filter
    bloom: true,
    // set random intervals(ms) between requests
    interval: () => (Math.random() * 16 + 4) * 1000, // [4s, 20s]
    // initial Link
    startUrls: ['https://github.com/trending'],
})

// download(name, cb)
crawler.download('trending', async ({ req, res, followLinks, resolveLink }) => {
    // parsing HTML strings
    let $ = cheerio.load(res.body.toString())
    // extract data
    let repoList = [],
        $rows = $('.Box-row')
    if ($rows.length) {
        $rows.each(function (index) {
            let $item = $(this)

            repoList.push({
                name: $('.lh-condensed a .text-normal', $item)
                    .text()
                    .replace(/\s+/g, ' ')
                    .trim(),
                href: $('.lh-condensed a', $item).attr('href'),
            })

            repoList.push(rank)
        })
        // print
        console.log(repoList) // or store in your Database
        // follow links
        rankList.forEach((v) => followLinks(resolveLink(v.href)))
    }
})

// start crawling
crawler.run()
```

## Custom Headers

The request hook will execute before each request:

```ts
// request(name, cb)
crawler.request('headers', async (context) => {
    // set custom headers
    Object.assign(context.req.headers, {
        'Cache-Control': 'no-cache',
        'User-Agent': userAgent(), // set random UserAgent
        Accept: '*/*',
        'Accept-Encoding': 'gzip, deflate, compress',
        Connection: 'keep-alive',
    })
})
```

## Routes

Instead of parsing everything in 'crawler.download()', you can split the parsing code into different routes:

```ts
crawler.route({
    url: 'https://github.com/trending', // for trending page (compatible with minimatch)
    async download(({req, res})){
        // parsing ...
    }
})

crawler.route({
    url: 'https://github.com/*/*', // for repository page
    async download(({req, res})){
        // parsing ...
    }
})

crawler.route({
    url: 'https://github.com/*/*/issues', // for issues page
    async download(({req, res})){
        // parsing ...
    }
})
```

## Proxy

You can provider a proxy server getter when initializing the crawler:

```ts
let crawler = new Crawler({
    name: 'myCrawler',
    startUrls: ['https://github.com/trending'],
    async proxy() {
        let url = await getProxyUrlFromSomeWhere()
        // The return value will be used as a proxy when sending a request
        return url
    },
})
```
