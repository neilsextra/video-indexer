'use strict'

const _Promise = require('bluebird');
const _Request = _Promise.promisifyAll(require('request'));
const _uuid = require('uuid');
const API_URL = 'https://api.videoindexer.ai/'

var Vindexer = function(location, apiKey, accountId, allowEdit) { 
    this.apiurl = API_URL;
    this.apiKey = apiKey;
    this.accountId = accountId;
    this.allowEdit = allowEdit;
    this.location = location;
}

Vindexer.prototype.listTokens = function() {
    var url = `${this.apiurl}auth/${this.location}/Accounts?generateAccessTokens=true&allowEdit=true"`;

    return _Request.getAsync({
        url: url,
        headers: { "Host": "api.videoindexer.ai",
                   "Ocp-Apim-Subscription-Key": this.apiKey }
    });

}

Vindexer.prototype.getToken = function() {
    var url = `${this.apiurl}auth/${this.location}/Accounts/${this.accountId}/AccessToken?allowEdit=true`;

    return _Request.getAsync({
        url: url,
        headers: { "Host": "api.videoindexer.ai",
                   "Ocp-Apim-Subscription-Key": this.apiKey }
    });

}

Vindexer.prototype.upload = function(token, params) {
    let generatedId = _uuid.v4();
    let url = `${this.apiurl}${this.location}/Accounts/${this.accountId}/Videos`;

    if (!params.name) { 
        params.name = `video_${generatedId}`; 
    }

    if (!params.accountId) { 
        params.accountId = this.accountId; 
    }

    if (!params.externaId) { 
        params.externaId = generatedId; 
    }

    params.accessToken = token;
    
    let formData = {};

    if (params.streamData) {
        formData = { file: 
            { value: params.streamData,
              options: 
               { filename: params.fileName,
                 contentType: null } } }
    }

    return _Request.postAsync({
        url: url,
        qs: params,
        headers: {  
            "Content-Type": "multipart/form-data",
            "Host": "api.videoindexer.ai"
        },
        formData: formData
    }).bind(this);
    
}

Vindexer.prototype.getVideoIndex = function(token, videoId, params) {
    var url = `${this.apiurl}${this.location}/Accounts/${this.accountId}/Videos/${videoId}/Index`;
 
    params.accessToken = token;
  
    if (!params.language) { 
        params.language = 'English'; 
    }

    return _Request.getAsync({
        url: url,
        qs: params,
        headers: {             
            "Host": "api.videoindexer.ai" }
    });
    
}

Vindexer.prototype.getThumbnail = function(token, videoId, thumbnailId, params) {
    var url = `${this.apiurl}${this.location}/Accounts/${this.accountId}/Videos/${videoId}/Thumbnails/${thumbnailId}`;

    params.accessToken = token;

    return _Request.getAsync({
        url: url,
        encoding: null,
        qs: params,
        headers: {             
            "Host": "api.videoindexer.ai" }  
    });

};

Vindexer.prototype.search = function(token, query) {
    var url = `${this.apiurl}${this.location}/Accounts/${this.accountId}/Videos/Search`;
    var params = {};

    params.accessToken = token;
    params.query = query;
    params.sourceLanguage = 'English';
    params.language = 'English';
    
    return _Request.getAsync({
        url: url,
        qs: params,
        headers: {             
            "Host": "api.videoindexer.ai" }  
    });

};

module.exports = Vindexer;