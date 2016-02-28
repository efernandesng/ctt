'use strict';

const Promise = require('bluebird');
const crypto = require('crypto');
const moment = require('moment-timezone');
const request = require('superagent');
const util = require('util');
const pkg = require('./package.json');

const pcRe = /^[0-9]{7}$/;

const defaultOptions = {
    osName: 'Android',
    osVersion: '5.1',
    appName: 'ctt.mobile.android.app.ctt',
    appVersion: '1.3.6',
    deviceId: crypto.randomBytes(8).toString('hex'),
    deviceName: 'device',
    authUser: 'ANDROID003',
    authKey: '59513E6C-CBA9-4ED8-8A63-147DBEA176B5',
    userAgent: `${pkg.name}/${pkg.version} (${pkg.homepage})`
};

let gConfig = Object.assign({}, defaultOptions);

function generateAuthKey(args) {
    let text = gConfig.appName
        + gConfig.appVersion
        + gConfig.osName
        + gConfig.osVersion
        + gConfig.deviceName
        + gConfig.deviceId;

    if (Array.isArray(args) && args.length > 0) {
        for (let i = 0; i < args.length; i++) {
            text += args[i];
        }
    }

    text += moment().tz('UTC').format('YYYYMMDDHHmm');

    return crypto
        .createHmac('sha512', gConfig.authKey)
        .update(text)
        .digest('hex');
}

function makeRequest(options) {
    return new Promise((resolve, reject)=> {
        request
            .post(`https://services.ctt.pt:8085/${options.path}`)
            .set('Content-Type', 'application/json')
            .set('User-Agent', gConfig.userAgent)
            .set({
                'x-device-id': gConfig.deviceId,
                'x-device-name': gConfig.deviceName,
                'x-os-name': gConfig.osName,
                'x-os-version': gConfig.osVersion,
                'x-app-name': gConfig.appName,
                'x-app-version': gConfig.appVersion,
                'x-auth-user': gConfig.authUser,
                'x-auth-key': options.key
            })
            .send(Object.assign(options.data, {
                'OSName': gConfig.osName,
                'OSVersion': gConfig.osVersion,
                'AppName': gConfig.appName,
                'AppVersion': gConfig.appVersion,
                'DeviceName': gConfig.deviceName,
                'DeviceID': gConfig.deviceId
            }))
            .end((err, res)=> {
                if (err) return reject(err);

                const data = res.body;

                if (data.hasOwnProperty('OperationResult')) {
                    const opResult = data['OperationResult'],
                        errCode = opResult['Code'],
                        errDescription = opResult['Description'];

                    return reject(new Error(`${errCode} - ${errDescription}`))
                }

                resolve(data);
            })
    })
}

const ctt = {
    config(options) {
        if (options === undefined) return Object.assign({}, gConfig);

        gConfig = Object.assign({}, defaultOptions, options);

        return this;
    },

    findAddressByPostcode(postcode, cb) {
        if (typeof postcode !== 'string' || !pcRe.test(postcode)) {
            return Promise.reject(new Error('Invalid Postcode! Expected format: XXXXXXX')).nodeify(cb);
        }

        const key = generateAuthKey([postcode]);
        const data = {InCodPos: postcode};

        return makeRequest({
            path: 'CTTServicesProxyPesquisaCP/api/codigospostais/pesquisacp',
            key,
            data
        }).nodeify(cb)
    }
};

module.exports = ctt;
