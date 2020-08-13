
// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// class to receive POSTS with build information

const firebaseEncode = require('../lib/firebase-encode');
const { InvalidParameterError, handleError } = require('../lib/errors');
const { isJson } = require('../util/validation');
const FILTERS_ALLOWED = ['tag', 'ref', 'os', 'matrix'];
const BatchService = require('../util/batches.js');
const moment = require('moment');

class GetBatchesHandler {
  constructor (app, client) {
    this.app = app;
    this.client = client;
    this.batchService = new BatchService();
  }

  async _getBuilds (req, utcOffset) {
    const repoid = firebaseEncode(req.params.orgname + '/' + req.params.reponame);
    let starterQuery = this.client.collection(global.headCollection).doc(repoid).collection('builds');

    const initDate = moment.utc().utcOffset(utcOffset).subtract(45, 'weeks').startOf('day').toDate();
    starterQuery = starterQuery.where('timestamp', '>=', initDate);

    FILTERS_ALLOWED.forEach(filter => {
      let filterValue = req.query[filter];
      if (filterValue) {
        if (filter === 'matrix') {
          if (!isJson(filterValue)) throw new InvalidParameterError('matrix parameter must be json');
          filterValue = JSON.parse(filterValue);
        } else filterValue = '' + filterValue; // sanitize the parameter

        starterQuery = starterQuery.where('environment.' + firebaseEncode(filter), '==', filterValue);
      }
    });

    const snapshot = await starterQuery.orderBy('timestamp', 'asc').get();
    const builds = [];
    snapshot.forEach(doc => builds.push(doc.data()));

    return builds;
  }

  async _getDayBuilds (req) {
    const repoid = firebaseEncode(req.params.orgname + '/' + req.params.reponame);

    let starterQuery = this.client.collection(global.headCollection).doc(repoid).collection('builds');

    const utcOffset = req.query.utcOffset ? parseInt(req.query.utcOffset) : 0;
    const reqDay = moment.unix(req.params.timestamp).utc().utcOffset(utcOffset, false);
    const startOfDay = reqDay.startOf('day').toDate();
    const endOfDay = reqDay.endOf('day').toDate();

    starterQuery = starterQuery.where('timestamp', '>=', startOfDay);
    starterQuery = starterQuery.where('timestamp', '<=', endOfDay);

    const snapshot = await starterQuery.orderBy('timestamp', 'asc').get();
    const builds = [];
    snapshot.forEach(doc => builds.push(doc.data()));

    return builds;
  }

  listen () {
    // return all batches for a repository
    this.app.get('/api/repo/:orgname/:reponame/batches', async (req, res) => {
      try {
        const utcOffset = req.query.utcOffset ? parseInt(req.query.utcOffset) : 0;
        const builds = await this._getBuilds(req, utcOffset);
        const batches = this.batchService.buildBatches(builds, utcOffset);
        res.send(batches);
      } catch (err) {
        handleError(res, err);
      }
    });

    // return all builds for a day
    this.app.get('/api/repo/:orgname/:reponame/batch/:timestamp', async (req, res) => {
      try {
        const builds = await this._getDayBuilds(req);
        res.send(builds);
      } catch (err) {
        handleError(res, err);
      }
    });
  }
}

module.exports = GetBatchesHandler;
