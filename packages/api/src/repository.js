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

const { Firestore } = require('@google-cloud/firestore');

const REPOSITORY_COLLECTION = 'repositories';

class Repository {
  constructor (client) {
    if (!client) {
      this.client = new Firestore({
        projectId: process.env.FLAKY_DB_PROJECT || 'flaky-dev-development'
      });
    } else {
      this.client = client;
    }
  }

  async create (identifier, params) {
    // TODO: DANGER we should have validation and what not at some point
    // before we do this, probably before this is called by the server too.
    return this.client.collection(REPOSITORY_COLLECTION).doc(identifier).set(params);
  }

  async get (identifier) {
    const document = await this.client.doc(`${REPOSITORY_COLLECTION}/${identifier}`).get();
    // TODO: we actually need to call doc.exists and check if this doc exists.
    return document.data();
  }

  async getCollection (identifier) {
    var result = [];
    await this.client.collection(`${identifier}`).get()
      .then(snapshot => {
        if (snapshot.empty) {
          console.log('No matching documents.');
          return;
        }

        snapshot.forEach(doc => {
          var entry = doc.data();
          result.push(entry);
        // console.log(doc.id, '=>',entry);
        });
      })
      .catch(err => {
        console.log('Error getting documents\n', err);
      });

    return result;
  }

  async delete (identifier) {
    const document = this.client.doc(`${REPOSITORY_COLLECTION}/${identifier}`);
    return document.delete();
  }
}

module.exports = Repository;
