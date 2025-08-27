import { SerialPort, ReadlineParser } from 'serialport';

// npx @serialport/repl /dev/tty.usbmodem24EC4A2C02742 9600
// npx @serialport/terminal -p /dev/tty.usbmodem24EC4A2C02742 -b 9600

const list = await SerialPort.list();
console.log(list);
process.exit();

const riotInfos = list.find(i => i.vendorId === '303a');


const port = new SerialPort({ path: riotInfos.path, baudRate: 9600 })
const parser = new ReadlineParser()
port.pipe(parser);
parser.on('data', console.log);

port.write('cfgrequest\n');
