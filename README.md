# The challenge with GTFS

[GTFS][1] files can be huge. Relations between files are handled with strings which adds to even worse performance if used as it is. Usually it is more useful only to parse the relevant information from the files to a custom format but what if you need all of the files? The NoSQL based solutions work well with custom data structure but generally they don't scale when the same data is used multiple ways.

GTFS file format works well with relational database as it is structed in such way. Then why not use it the way it is?

# GTFSdb
GTFSdb is a database abstraction that deals with [GTFS][1] files. It is designed to support huge GTFS files with minimal memory overhead. GTFSdb was inspired by [node-GTFS][2] and should be  a drop-in-replacement only with some minor changes to the code.

For GTFSdb to work it needs Knex.js with the underlying database (PostgreSQL, MariaDB, MySQL, SQLite). So far GTFSdb has only been tested with PostgreSQL.

# Example application
An example application is still a work in progress.

# Installation
Instructions are updated here once the package hits npm. In the meantime GTFSdb can be either copied to your project or used as a submodule.

# Configuration
GTFSdb needs to be configured with an instance of [Knex.js][4] to enable the database connection. For more information on how to make Knex.js work, please refer to [its guide][5]. In your Node.js application you can configure GTFSdb in the following way:

```
// First get an instance of Knex.
var knex = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING,
  searchPath: 'knex,public'
});
// Then load the library
var gtfsdb = require('gtfsdb')(knex);
```

# Schema migrations
For schema creation GTFSdb includes migration scripts. To get the latest schema specify a `knexfile.js` with a following key:
```
    migrations: {
        directory: './path/to/gtfsdb/migrations'
    }
```

And then run:

```
knex migrate:latest
```

# Data import
For data import GTFSdb provides a download utility to deal with different kinds of sources. You can use the utility directly:

```
var knex = /*...*/
var config = require('./config.js');
var download = require('../path/to/gtfsdb/lib/download');
/* ... */
download(knex, config).then( /* Handle the promise */ );
```
Or through the GTFSdb API.

GTFSdb configuration file has the same format as with its sibling. The configuration has the same format as with `node-GTFS`. Here's an example of `config.js`:

``` 
module.exports = {
  agencies: [
    /*
     * You can specify agencies in the following ways:
     * * Put agency_key names from gtfs-data-exchange.com:
     * 'bay-area-rapid-transit'
     *
     * * Specify a download URL:
     * {agency_key: 'caltrain', url: 'http://www.gtfs-data-exchange.com/agency/caltrain/latest.zip'}
     *
     * * Specify a path to a zipped GTFS file:
     * {agency_key: 'localAgency', path: '/path/to/the/gtfs.zip'}
     *
     * * Specify a path to an unzipped GTFS file:
     * {agency_key: 'localAgency', path: '/path/to/the/unzipped/gtfs/'}
     */
  ]
};
```
# What you need to know
- The API is still in flux; to be honest it isn't even complete yet.
- There are no tests. None, nil, zip. There will be, however, some beautiful day.

# Planned features
- Compare the GTFS file date to avoid redundant imports.
- Decent test coverage.
- An example project to demonstrate the use better.

[1]: https://developers.google.com/transit/gtfs/
[2]: https://github.com/brendannee/node-gtfs
[3]: https://github.com/mkko/gtfs-to-html
[4]: http://knexjs.org
[5]: http://knexjs.org/#Installation
[6]: http://bussinavi.fi