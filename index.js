const net = require('net'),
    mongo = require('@intugine-technologies/mongodb'),
    spectrum = require('@intugine-technologies/spectrum'),
    config = require('./config.json'),
    axios = require('axios'),
    mqtt_publisher = require('./mqtt_publisher');

let db = null;
const parse_data = (data) => {
    if (data.indexOf('@@') > -1) {
        try {
            return spectrum(data);
        } catch (e) {
            return data;
        }
    } else {
        return undefined;
    }
};
const geolocation = (cell) => axios({
    url: `${config.GEOLOCATION_API}/${cell[0]}/${cell[1]}/${cell[2]}/${cell[3]}`,
    method: 'GET'
});
const server = net.createServer();
server.on('connection', (socket) => {
    socket.setEncoding('utf8');
    const client = `${socket.remoteAddress}:${socket.remotePort}`
    console.log({
        event: 'connection',
        client
    });
    socket.on('data', (data) => {
        console.log({
            event: 'data',
            data,
            client
        })
        const parsed_data = parse_data(data);
        if (parsed_data && Array.isArray(parsed_data) && parsed_data.length > 0 && parsed_data[0].imei) {
            if (parsed_data.filter(i => !i.gps[0]).length > 0) {
                Promise.all(parsed_data.map(i => geolocation([i.cellTower[0], i.cellTower[1], parseInt(i.cellTower[2]).toString(16), parseInt(i.cellTower[3]).toString(16)])))
                    .then((r) => {
                        r.forEach((i, index) => {
                            if (i.data) {
                                parsed_data[index].gsm = [i.data.location.lat, i.data.location.lng]
                            }
                        })
                    })
                    .catch((e) => {
                        console.error('Some error in fetching the celltower data', e && e.response ? e.response.data : e)
                    })
                    .finally(() => {
                        add_data(parsed_data);
                    })
            } else add_data(parsed_data)
        } else {
            console.error('Some error in parsing data', data)
            add_invalid_data(data)
        }
    })
    socket.on('error', (err) => {
        console.log({
            event: 'error',
            err,
            client
        });
    })
    socket.on('close', () => {
        console.log({
            event: 'close',
            client
        });
    })
    socket.on('end', () => {
        console.log({
            event: 'end',
            client
        });
    })
});

server.on('error', (err) => {
    console.error(err);
});
server.on('close', (err) => {
    console.error(err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', reason.stack || reason);
});
const fetch_device = (imei) => new Promise((resolve) => {
    db.read('devices', {
            imei
        })
        .then((r) => {
            resolve(r && r[0] ? r[0] : undefined);
        })
        .catch((e) => {
            resolve(undefined);
        });
});
const add_data = (data) => {
    fetch_device(data[0].imei)
        .then((r) => {
            data = data.map((i) => ({ ...i,
                device: (r && r.id) ? r.id : 'NA'
            }));
            if (r && r.client) mqtt_publisher.publish(r.client, JSON.stringify(data));
            return db.create('data', data);
        })
        .then((r) => {
            // console.log('Data inserted');
        }, (e) => {
            console.error('Error in pushing data to DB', e);
        })
    return;
}

const add_invalid_data = (data) => {
    db.create('NON_PARSED_DATA', {
            data
        })
        .then((r) => {}, (e) => {})
    return;
}
mongo(config.DB_URI, config.SPECTRUM_DB_NAME)
    .then((DB) => {
        db = DB;
        console.log('SPECTRUM_SERVER Connected to DB');
        server.listen(config.SPECTRUM_TCP_SERVER_PORT, () => {
            console.log('SPECTRUM_TCP_SERVER Listening on', config.SPECTRUM_TCP_SERVER_PORT);
        });
    })
    .catch((e) => {
        console.error('Error in connecting to DB', e)
    })