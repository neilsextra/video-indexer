/**
 * Application Service to demonstrate the Video Indexer
 * 
 * @author Neil Brittliff
 */

const express = require('express');
const routes = require('./routes');
const http = require('http');
const https = require('https');
const path = require('path');
const azure = require('azure-storage');
const pug = require('pug');
const multiparty = require('multiparty');
const os = require('os');
const url = require('url');
var favicon = require('serve-favicon');
var methodOverride = require('method-override');
var bodyParser = require('body-parser');
var logger = require('morgan');
var errorHandler = require('errorhandler')

const vindexer = require('./vindexer');
const search = require('./search');

var crypto = require("crypto-js");

const streamBuffers = require('stream-buffers');

var app = express();

const UPLOADED_STATUS = 'uploaded';

app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(logger('dev'));
app.use(methodOverride());
app.use(express.json());


if (process.env.NODE_ENV === 'development') {
  app.use(errorhandler())
}

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use("/modules", express.static(path.join(__dirname, 'node_modules')));

var config = require('./config.json');
var schema = require('./schema.json');
var stopwords = require('./stopwords.json');

var keys = {};

// Get the Key - this file should never be checked in and may not be preset
try {
  keys = require('./keys.json');
} catch (e) {
}

var entGen = azure.TableUtilities.entityGenerator;

var blobContainer = process.env.AZURE_BLOB_CONTAINER || config.blobContainer;
var blobTable = process.env.AZURE_BLOB_TABLE || config.blobTable;
var blobPart = process.env.AZURE_BLOB_PART || config.blobPart;
var blobUri = process.env.AZURE_BLOB_URI || config.blobUri;

var searchKey = process.env.SEARCH_KEY || keys.searchKey;
var searchUrl = process.env.SEARCH_URL || config.searchUrl;
var searchIndex = process.env.SEARCH_INDEX || config.searchIndex;

var videos = {};
var progress = {};
var token = null;

/**
 * Log an Informational Message
 * 
 * @param {string} message 
 * 
 */
function logInfo(message) {

  console.log(new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + ' [INFO] ' + message);

}

/**
 * Log an Error Message
 * 
 * @param {string} message 
 * 
 */
function logError(message) {

  console.log(new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + ' [ERROR] ' + message);

}

/**
 * Log an Warn Message
 * 
 * @param {string} message 
 * 
 */
function logWarn(message) {

  console.log(new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + ' [WARN] ' + message);

}

/**
 * Create an Entry to be returned back to the client
 * 
 * @param {JSON} entity the Entity
 * 
 */
function createEntry(entity) {
  var entry = {};

  entry.name = entity.RowKey._;
  entry.guid = entity.guid._;
  entry.timestamp = entity.Timestamp._;
  entry.videoId = entity.videoId._;
  entry.videoUrl = entity.videoUrl._;
  entry.thumbnailUrl = entity.thumbnailUrl._;
  entry.blobUri = entity.blobUri._;
  entry.container = entity.container._;

  if (entity.breakdownUrl) {
    entry.breakdownUrl = entity.breakdownUrl._;
  }

  if (entity.size) {
    entry.size = entity.size._;
  }

  if (entity.processingProgress) {
    entry.processingProgress = entity.processingProgress._;
  }

  if (entity.status) {

    entry.status = entity.status._;

  }

  return entry;

}

/**
 * Get all the values with a specific key
 * @param {*} obj the JSON onject
 * @param {*} key the key to find 
 * 
 * @return a list of objects with that key value
 * 
 */
function getValues(obj, key) {
  var objects = [];

  for (var iObj in obj) {

    if (!obj.hasOwnProperty(iObj)) {
      continue;
    }

    if (typeof obj[iObj] == 'object') {

      objects = objects.concat(getValues(obj[iObj], key));

    } else if (iObj == key) {

      objects = objects.concat(obj[iObj].toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').split(' '));

    }

  }

  return objects;

}

/**
 * Get all the objects
 * 
 * @param {*} obj the object
 * @param {*} key the key name
 * 
 * @return a list of objects with that key value
 * 
 */
function getObjects(obj, key) {
  var objects = [];

  for (var i in obj) {
    if (!obj.hasOwnProperty(i)) continue;

    if (typeof obj[i] == 'object') {
      objects = objects.concat(getObjects(obj[i], key));
    } else if (i == key) {
      objects.push(obj[i]);
    }

  }

  return objects;

}

app.get('/getToken', function (req, res, next) {
  var indexerSvc = new vindexer(process.env.VIDEO_INDEXER_LOCATION || config.vindexerLocation,
    process.env.VIDEO_INDEXER_SUBSCRIPTION || keys.videoSub,
    process.env.VIDEO_ACCOUNTID || keys.accountId,
    'true');

  indexerSvc.getToken().then(function (result) {

    res.send(result.body);

  });

});

/**
 *  Respond to Search Request
 * 
 *  @param {string} uri The search Uri
 *  @param {function} callback The callback function to process the Http Request
 * 
 */
app.get('/search:filter?', function (req, res, next) {
  var filter = req.param('filter');

  logInfo(`Searching - '${filter}'`);

  var service = new search(searchUrl, searchKey, searchIndex);

  service.search(filter).then(function (result) {
    var storageTableQuery = azure.TableQuery;
    var tableQuery = new storageTableQuery().top(1000);
    var filters = [];

    var hits = JSON.parse(result.body);

    for (value in hits.value) {

      console.log(hits.value[value].key);

      filters.push(hits.value[value].key);

    }

    queryTableFilteredEntries(tableQuery, filters, null, function (entries) {

      res.status(200).send(entries);

    });

  });

});

/**
 * Respond to Get Request - Delete Video
 * 
 * @param {string} filter The URI Filter
 * @param {function} responder The responder to the web application
 * 
 */
app.get('/delete:videoId?', function (req, res, next) {
  var name = req.param('videoId');
  var blobSvc = azure.createBlobService(process.env.AZURE_BLOB_SERVICE || config.blobService, process.env.AZURE_BLOB_STORAGE_KEY || keys.blobKey);
  var tableSvc = azure.createTableService(process.env.AZURE_BLOB_SERVICE || config.blobService, process.env.AZURE_BLOB_STORAGE_KEY || keys.blobKey);

  tableSvc.retrieveEntity(blobTable, blobPart, name, function (error, result, response) {
    if (!error) {
      video = result;
      blobSvc.deleteBlob(blobContainer, name, function (error, response) {
        if (!error) {
          logInfo('Video Blob - \'' + name + '\' - deleted');

          if (video.thumbnailUrl && video.thumbnailUrl._ != '') {
          }

        } else {
          logError(error);
          res.send(error);
        }

      });

    } else {
      logError(error);
      res.send(error);
    }

  });

});

/**
 * Respond to Get Request - Retrieve all Videos
 * 
 * @param {string} filter The URI Filter
 * @param {function} responder The responder to the web application
 * 
 */
app.all('/retrieve?', function (req, res, next) {

  retrieveVideos(req, res, next);

});

/**
 * Respond to Query Request - Retrieve specified Video
 * 
 * @param {string} filter The URI Filter
 * @param {function} responder The responder to the web application
 * 
 */
app.all('/query:filename?', function (req, res, next) {
  var tableSvc = azure.createTableService(process.env.AZURE_BLOB_SERVICE || config.blobService, process.env.AZURE_BLOB_STORAGE_KEY || keys.blobKey);
  var filename = req.param('filename');
  tableSvc.createTableIfNotExists(blobTable, function (error, result, response) {
    logInfo(`Table: '${blobTable}' create command issued status - ${result.statusCode}`);

    var tableQuery = TableQuery.stringFilter('RowKey', QueryComparisons.EQUAL, filename);
    var continuationToken = null;
    tableSvc.queryEntities(blobTable, tableQuery, continuationToken, function (error, result) {

      if (error) {
        res.status(500).send(error)
        return;
      }

      res.status(200).send(JSON.stringify(results));

    });

  });

});

/**
 * Respond to Get Request - Retrieve all Videos
 * 
 * @param {string} filter The URI Filter
 * @param {function} responder The responder to the web application
 * 
 */
app.all('/breakdown/:guid?:breakdownUrl?', function (req, res, next) {
  var guid = req.param('guid');
  var breakdownUrl = req.param('breakdownUrl');

  getBreakdown(guid, breakdownUrl, req, res);

});

/**
 * Respond to Get Request - Process VIdeo
 * 
 * @param {string} filter The URI Filter
 * @param {function} responder The responder to the web application
 * 
 */
app.get('/process/:filename?:guid?', function (req, res, next) {
  var filename = req.param('filename');
  var guid = req.param('guid');

  logInfo(`Processing: '${guid}/${filename}'`);

  createTableEntry(filename, guid, function (err) {

    if (err) {
      res.status(500).send(JSON.stringify(err));

      return;

    } else {

      res.status(200).send('OK');

      indexVideo(filename, guid);

    }

  });

});

/**
 * Respond to Get Request - Commit Video
 * 
 * @param {string} filter The URI Filter
 * @param {function} responder The responder to the web application
 * 
 */
app.get('/commit:filename?:guid?', function (req, res, next) {
  var filename = req.param('filename');
  var guid = req.param('guid');

  var fullFileName = `${guid}/${filename}`;

  logInfo(`Listing Uncommitted: ${fullFileName}`);

  var blobSvc = azure.createBlobService(process.env.AZURE_BLOB_SERVICE || config.blobService, process.env.AZURE_BLOB_STORAGE_KEY || keys.blobKey);

  blobSvc.listBlocks(blobContainer, fullFileName, 'uncommitted', function (err, list, response) {

    if (err) {
      logError(JSON.stringify(err));
      res.status(500).send(err.message);
      return;

    }

    var uncommittedBlocks = list.UncommittedBlocks;
    var blocks = [];

    for (var uncommittedBlock in uncommittedBlocks) {
      blocks.push(uncommittedBlocks[uncommittedBlock].Name)
    }

    logInfo(`Committing Blocks:'${guid}/${filename}' - ${blocks.length}`);

    blobSvc.commitBlocks(blobContainer, fullFileName, { LatestBlocks: blocks }, function (err) {

      if (err) {
        logError(JSON.stringify(err));
        res.status(500).send(err.message);
      } else {
        logInfo(`Committed Blocks: '${guid}/${filename}' - ${blocks.length}`);
        res.status(200).send('OK');
      }

    });

  });

});

/**
 * Upload the Video
 * 
 * @param {string} filter The Video Id
 * @param {function} responder The responder to the web application
 *
 */
app.post('/upload', function (req, res, next) {

  function lpad(n, width, z) {
    z = z || '0';
    n = n + '';

    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;

  }

  var form = new multiparty.Form();
  var blobSvc = azure.createBlobService(process.env.AZURE_BLOB_SERVICE || config.blobService, process.env.AZURE_BLOB_STORAGE_KEY || keys.blobKey);
  var chunk = 0;
  var filename = '<untitled>';
  var guid = '';

  form
    .on('part', function (part) {

      if (part.filename) {
        var size = part.byteCount;
        var blockId = lpad(chunk, 32);

        if (guid == '') {
          guid = crypto.MD5(filename).toString();
          console.log(`${filename} - GUID - ${guid}`);

        }

        var fullFileName = `${guid}/${filename}`;

        console.log(`'${guid}/${filename}' - Chunk - ${blockId} - Size : ${part.byteCount}`);

        blobSvc.createContainerIfNotExists(blobContainer, {
          publicAccessLevel: 'blob'
        },
          function (error, result, response) {

            blobSvc.createBlockFromStream(blockId, blobContainer, fullFileName, part, size, function (err) {

              if (err) {
                logError(JSON.stringify(err));

                res.status(500).send(err);
              } else {
                res.status(200).send(JSON.stringify(
                  {
                    statusCode: 200,
                    filename: filename,
                    guid: guid
                  }
                ));
              }

            });

          }

        );

      } else {
        form.handlePart(part);
      }

    })
    .on('field', function (name, value) {

      if (name == 'chunk') {
        chunk = value;
      }

      if (name == 'filename') {
        filename = value;
      }

      if (name == 'guid') {
        guid = value;
      }

    })
    .on('err', function (err) {

      logError(err);
      res.send(err);

    })
    .on('end', function () {
      res.end('OK');
    });

  form.parse(req);

});

/**
 * It all starts here ...
 */
app.get('/', routes.index);

http.createServer(app).listen(app.get('port'), async function () {

  function createTable() {
    return new Promise((accept, reject) => {
      var tableSvc = azure.createTableService(process.env.AZURE_BLOB_SERVICE || config.blobService, process.env.AZURE_BLOB_STORAGE_KEY || keys.blobKey);

      tableSvc.createTableIfNotExists(blobTable, function (error, result, response) {

        logInfo(`Table: '${blobTable}' create command issued status - ${result.statusCode}`);

        accept("OK");

      });

    });

  }

  function createIndex() {
    return new Promise((accept, reject) => {
      var service = new search(searchUrl, searchKey, searchIndex);

      service.create(schema).then(function (result) {
        logInfo(`Index Result: ${result.statusCode} - ${JSON.stringify(result.body)}`);
        
        accept("OK");

      });

    });
  
  }
  
  await createTable();
  await createIndex();

  logInfo(`Server Started - Listening: ${app.get('port')}`);

});

/**
 * List all the Blobs within a container 
 * 
 * @param {*} req the HTTP request
 * @param {*} res the HTTP response
 * @param {*} next next in the chain
 */
function retrieveVideos(req, res, next) {
  var tableSvc = azure.createTableService(process.env.AZURE_BLOB_SERVICE || config.blobService, process.env.AZURE_BLOB_STORAGE_KEY || keys.blobKey);

  tableSvc.createTableIfNotExists(blobTable, function (error, result, response) {
    var storageTableQuery = azure.TableQuery;
    var tableQuery = new storageTableQuery().top(1000);

    var entries = [];

    queryTableEntries(tableSvc, tableQuery, null, entries, function () {

      res.send(entries);

    });

  });

}

/**
 * Query the Table for Videos
 * 
 * @param {*} tableSvc the table service
 * @param {*} query the table to query
 * @param {*} continuationToken the continuation token
 * @param {*} entries the resultant entry array
 * 
 */
function queryTableEntries(tableSvc, tableQuery, continuationToken, entries, callback) {
  var tableSvc = azure.createTableService(process.env.AZURE_BLOB_SERVICE || config.blobService, process.env.AZURE_BLOB_STORAGE_KEY || keys.blobKey);

  tableSvc.queryEntities(blobTable, tableQuery, continuationToken, function (error, result) {

    if (!result) {
      callback();
      return;
    }

    var entities = result.entries;

    for (var entity in entities) {

      entries.push(createEntry(entities[entity]));

    }

    var continuationToken = result.continuationToken;

    callback();

  });

}

/**
 * Query the Table with Filter
 * @param {*} query the table query
 * @param {*} filters the filters
 * @param {*} continuationToken the continuation token
 * @param {*} entries the resultant entry array
 */
function queryTableFilteredEntries(tableQuery, filters, continuationToken, callback) {
  var entries = [];

  var tableSvc = azure.createTableService(process.env.AZURE_BLOB_SERVICE || config.blobService, process.env.AZURE_BLOB_STORAGE_KEY || keys.blobKey);

  tableSvc.queryEntities(blobTable, tableQuery, continuationToken, function (error, result) {

    console.log(filters);

    if (!result) {
      callback();
      return;
    }

    var entities = result.entries;

    loop: for (var entity in entities) {
      console.log(entities[entity].guid._ + "=" + filters + " : " + filters.indexOf(entities[entity].guid._));

      if (filters.indexOf(entities[entity].guid._)) {
        continue loop;
      }

      entries.push(createEntry(entities[entity]));

    }

    var continuationToken = result.continuationToken;

    callback(entries);

  });

}

/**
 * Get the Breakdown
 * 
 * @param {string} guid uniquely identifies the video
 * @param {string} breakdownUrl the Breakdown URL
 * @param {object} req the request
 * @param {object} res the response
 * 
 */
function getBreakdown(guid, breakdownUrl, req, res) {
  var blobSvc = azure.createBlobService(process.env.AZURE_BLOB_SERVICE || config.blobService, process.env.AZURE_BLOB_STORAGE_KEY || keys.blobKey);
  var filename = `${guid}/${breakdownUrl}`;

  console.log(`Retrieving Breakdown - ${filename}`);

  blobSvc.getBlobToText(blobContainer, filename, function (error, text) {

    if (error) {
      console.error(error);
      res.status(404).send('Fail to obtain getBreakdown');
    } else {
      var data = JSON.parse(text);
      res.status(200).send(data);
    }

  });

}

/**
 * Create the Table Entry
 * 
 * @param {string} filename the video's filename 
 * @param {string} guid the video's universal identifier
 * @param {function} callback called when the function has completed 
 */
function createTableEntry(filename, guid, callback) {
  var tableSvc = azure.createTableService(process.env.AZURE_BLOB_SERVICE || config.blobService, process.env.AZURE_BLOB_KEY || keys.blobKey);

  logInfo(`File: '${filename}' - + blobTable + '\'`);

  tableSvc.createTableIfNotExists(blobTable, function (error, result, response) {

    var videoUrl = `${blobUri}/${blobContainer}/${guid}/${filename}`;

    var video = {
      PartitionKey: entGen.String(blobPart),
      RowKey: entGen.String(filename),
      blobUri: entGen.String(blobUri),
      container: entGen.String(blobContainer),
      guid: entGen.String(guid),
      videoId: entGen.String(''),
      videoUrl: entGen.String(videoUrl),
      thumbnailUrl: entGen.String(''),
      status: entGen.String(UPLOADED_STATUS),
      processingProgress: entGen.String('0%')
    };

    tableSvc.insertEntity(blobTable, video, function (error, result, response) {

      if (error) {
        logError(`[insertEntity]: ${error}`);

        tableSvc.replaceEntity(blobTable, video, function (error, result, response) {
          if (error) {
            logError(`[replaceEntity]: ${error}`);
          } else {
            logInfo(`Video: '${video.RowKey._}' - replaced`);
          }

          logInfo(`Entity: '${filename}' - registered`);
          callback(error);

        });

      } else {

        logInfo(`Entity: '${filename}' - registered`);
        callback(null);

      }

    });

  });

}

/**
 * Update the Processing summary
 * 
 * @param {string} filename the video filename  
 * @param {string} guid uniquely identifies a video
 * @param {string} id the video id
 * @param {string} status the video status
 * @param {string} processingProgress the current progress
 * @param {function} callback called when comleted
 * 
 */
function updateProcessingSummmary(filename, guid, id, status, processingProgress, callback) {
  var tableSvc = azure.createTableService(process.env.AZURE_BLOB_SERVICE || config.blobService, process.env.AZURE_BLOB_KEY || keys.blobKey);

  logInfo(`Updating Table Entry: '${filename}' - ${id} - ${status} - ${processingProgress}`);

  var video = {
    PartitionKey: entGen.String(blobPart),
    RowKey: entGen.String(filename),
    guid: entGen.String(guid),
    videoId: entGen.String(id),
    status: entGen.String(status),
    blobUri: entGen.String(blobUri),
    breakdownUrl: entGen.String(`breakdown.json`),
    processingProgress: entGen.String(processingProgress)
  }

  tableSvc.mergeEntity(blobTable, video, function (error, result, response) {

    callback(error);

  });

}

function updateThumbnailUrl(name, guid, id, thumbnailId, callback) {
  var tableSvc = azure.createTableService(process.env.AZURE_BLOB_SERVICE || config.blobService, process.env.AZURE_BLOB_KEY || keys.blobKey);

  var fullFileName = `${blobUri}/${blobContainer}/${guid}/${thumbnailId}.jpg`
  logInfo(`Video: '${name}' - ${id} - '${fullFileName}'`);

  var video = {
    PartitionKey: entGen.String(blobPart),
    RowKey: entGen.String(name),
    thumbnailUrl: entGen.String(`${fullFileName}`)
  }

  tableSvc.mergeEntity(blobTable, video, function (error, result, response) {

    callback();

  });

}

/**
 * Indexing the video
 * 
 * @param {string} filename  the video's file name
 * @param {string} guid  the video's universal identifier
 * 
 */
function indexVideo(filename, guid) {
  var indexerSvc = new vindexer(process.env.VIDEO_INDEXER_LOCATION || config.vindexerLocation,
    process.env.VIDEO_INDEXER_SUBSCRIPTION || keys.videoSub,
    process.env.VIDEO_ACCOUNTID || keys.accountId,
    'true');
  logInfo(`Initiating indexing: ${filename} - ${guid}`);

  indexerSvc.getToken().then(function (result) {

    var videoUrl = `${blobUri}/${blobContainer}/${guid}/${filename}`;
    var params = {};

    params.name = filename;
    params.videoUrl = videoUrl;

    logInfo(`Indexing: '${videoUrl}'`);

    var indexToken = JSON.parse(result.body);

    indexerSvc.upload(indexToken, params).then(function (result) {

      if (result.statusCode != '200') {
        logError(`Video: '${filename}' - index failed - '${result.statusCode}'`);
        return;
      }

      var output = JSON.parse(result.body);

      var id = output.id;

      updateProcessingSummmary(filename, guid, id, 'Started', '0%', function (error) {

        if (error) {
          logError(`Video: '${filename}' [${guid}] - index failed - '${JSON.stringify(error)}'`);
        } else {
          setTimeout(indexStatusCheckTimer, 6000, indexToken, filename, guid, id);
        }

      });

    });

  });

  /**
   * Check to see if the video has been indexed (processed)
   * 
   * @param {object} indexToken the Video Indexer's token
   * @param {string} filename 
   * @param {string} guid 
   * @param {string} id 
   * 
   */
  function indexStatusCheckTimer(indexToken, filename, guid, id) {
    var indexerSvc = new vindexer(process.env.VIDEO_INDEXER_LOCATION || config.vindexerLocation,
      process.env.VIDEO_INDEXER_SUBSCRIPTION || keys.videoSub,
      process.env.VIDEO_ACCOUNTID || keys.accountId,
      'true');

    logInfo(`Checking: '${filename}' - ${guid} - [${id}]`);

    var params = {};
    indexerSvc.getVideoIndex(indexToken, id, {}).then(function (result) {

      if (result.statusCode == "200") {
        var output = JSON.parse(result.body);
        var processingProgress = output.videos[0].processingProgress;

        processingProgress = (processingProgress == null || processingProgress == '') ? '0%' : processingProgress;

        updateProcessingSummmary(filename, guid, id, output.state, processingProgress, function () {

          if (output.state == 'Processing' || output.state == 'Uploaded') {

            setTimeout(indexStatusCheckTimer, 6000, indexToken, filename, guid, id);

          } else if (output.state == 'Processed') {
            logInfo(`Video: '${filename}' - ${guid} - thumbnailId - ${output.summarizedInsights.thumbnailId}`);

            storeBreakdown(indexToken, filename, guid, id, output);

            var thumbnailUrl = output.summarizedInsights.thumbnailId;

            updateThumbnailUrl(filename, guid, id, thumbnailUrl, function () {

              logInfo(`Saved: '${filename}' - ${guid} - [${id}] - '${thumbnailUrl}'`);

            });

          }

        });

      } else {

        logInfo(`Video: '${filename}' - processing - failed`);

      }

    });

  }

  /**
   * Store the brake down and store all associated thumbnails
   * 
   * @param {object} indexToken the index token
   * @param {string} filename the filename
   * @param {string} guid universally identifies the video
   * @param {string} id the video identifier returned from the video i9ndexer
   * @param {json} breakdown the video breakdown
   * 
   */
  function storeBreakdown(indexToken, filename, guid, id, breakdown) {
    var blobSvc = azure.createBlobService(process.env.AZURE_BLOB_SERVICE || config.blobService, process.env.AZURE_BLOB_STORAGE_KEY || keys.blobKey);

    blobSvc.createContainerIfNotExists(blobContainer, {
      publicAccessLevel: 'blob'
    },
      function (error, result, response) {
        logInfo(`Saving Breakdown: '${filename}' - ${guid} - [${id}]`);

        var blobName = `${guid}/breakdown.json`;

        blobSvc.createBlockBlobFromText(blobContainer, blobName, JSON.stringify(breakdown), err => {
          logInfo(`Saved Breakdown: '${filename}' - '${blobName}'`);

          indexBreakdown(filename, guid, id, breakdown);

          getThumbnails(indexToken, guid, id, breakdown).then(function (result) {
            logInfo(`All Thumbnails saved: '${filename}'`);

          });

        });

      });

  }

  /**
   * Index the Breakdown
   * 
   * @param {string} filename the Video's filname
   * @param {string} guid the Video's unique identifier
   * @param {string} id the identifier allocated by the Video Indexer
   * @param {json} breakdown the Video Breakdown
   */
  function indexBreakdown(filename, guid, id, breakdown) {

    logInfo(`Indexing Breakdown: '${filename}' - ${guid} - [${id}]`);

    var terms = getValues(breakdown, 'text');

    var entry = {
      "value": [
        {
          "@search.action": "upload",
          "key": guid,
          "terms": terms
        }
      ]

    }

    var service = new search(searchUrl, searchKey, searchIndex);

    service.insert(entry).then(function (result) {

      logInfo(`Indexed Breakdown: '${filename}' - ${guid} - [${id}] - ${result.statusCode}`);

    });

  }

  /**
   * Get the Thumbnails
   * 
   * @param {string} indexToken the index token
   * @param {string} guid the Video's unique identifier
   * @param {string} id the identifier allocated by the Video Indexer
   * @param {json} breakdown the Video Breakdown
   * 
   */
  async function getThumbnails(indexToken, guid, id, breakdown) {
    var thumbnails = getObjects(breakdown, 'thumbnailId');

    logInfo(`Thumbnail Available: ${thumbnails.length}`);

    for (var thumbnail in thumbnails) {

      await getThumbnail(indexToken, guid, id, thumbnails[thumbnail]);

    }

    return 'OK';

  }

  function getThumbnail(indexToken, guid, id, thumbnailId) {

    return new Promise(resolve => {
      indexerSvc.getThumbnail(indexToken, id, thumbnailId, {}).then(function (result) {
        var readableStreamBuffer = new streamBuffers.ReadableStreamBuffer({
          frequency: 10,
          chunkSize: 2048
        });

        readableStreamBuffer.put(result.body);

        storeThumbnail(id, thumbnailId, `${guid}/${thumbnailId}.jpg`, readableStreamBuffer, result.body.length - 1,

          function (error) {

            resolve(error);

          });

      });

    });

  }

  /**
   * Store the Thumbnail
   * @param {string} id the Thumbnail Identifier
   * @param {string} thumbnailId 
   * @param {string} thumbnailUrl 
   * @param {stream} stream 
   * @param {integer} size 
   * @param {function} callback 
   */
  function storeThumbnail(id, thumbnailId, thumbnailUrl, stream, size, callback) {
    var blobSvc = azure.createBlobService(process.env.AZURE_BLOB_SERVICE || config.blobService, process.env.AZURE_BLOB_STORAGE_KEY || keys.blobKey);

    blobSvc.createContainerIfNotExists(blobContainer, {
      publicAccessLevel: 'blob'
    },
      function (error, result, response) {
        logInfo(`Saving Thumbnail: [${id}] - '${thumbnailId}' - '${thumbnailUrl}' - ${size}`);

        blobSvc.createBlockBlobFromStream(blobContainer, thumbnailUrl, stream, size, function (error) {

          if (error) {
            logInfo(`Thumbnail error: [${id}] - '${thumbnailId}' - ${error}`);
          } else {
            logInfo(`Saved Thumbnail [${id}] - '${thumbnailId}' - ${thumbnailUrl} - ${size}`);
          }

          callback(error);

        });

      });

  }

}