let express = require("express");
let app = (module.exports = express.Router());
import DCM4CHEE from './DCM4CHEE';
import {element} from 'protractor';
let each = require("foreach");
const {
	exec,
	execSync
} = require("child_process");
let Pacs = new DCM4CHEE('DCM4CHEE', 'localhost', '11112');
let moment = require("moment-strftime");
let tempnam = require('tempnam');
const fs = require('fs');
const download = require("download");
let Iconv = require("iconv").Iconv;
let sleep = require("sleep");
let appRoot = require('app-root-path');
const axios = require('axios');
let request = require('request');


const defaults = {
	encoding: "utf8",
	timeout: 0,
	maxBuffer: 1024 * 1024,
	killSignal: "SIGTERM",
	cwd: null,
	env: null
}

app.post("/executeCreateUps", function (req, res) {
	console.log(req.query);
	let command = 'dcmups create ' + req.query.hostName + ' -f ' + 'G:\\wamp64\\www\\RIS\\assets\\upsxml\\' + req.query.fileName + '.xml';
	console.log(command);
	const child = exec(command, (error, stdout, stderr) => {
		if (error) {
			console.log("this is error", error);
			res.json(false);
			return true;
		}
		outputRes = stdout.split('\n')
		res.json(outputRes);
		console.log(stdout);
	});
});

app.post("/claimUPS", function (req, res) {
	console.log(req.query);
	let command = 'dcmups chstate ' + req.query.hostName + ' -iuid ' + req.query.iuid + ' -state "' + req.query.state + '" ' + req.query.iuid + '.1';
	console.log(command);
	const child = exec(command, (error, stdout, stderr) => {
		if (error) {
			console.log("this is error", error);
			res.json(false);
			return true;
		}
		outputRes = stdout.split('\n')
		res.json(outputRes);
		console.log(stdout);
	});
});

app.get("/", function (req, res) {
	res.send("GET request to the homepage");
});

app.get("/getDicom", function (req, res) {
	console.log(req.url);
	let operation = typeof req.query.operation != 'undefined' ? req.query.operation : 'cfind';
	let studyUID = req.query.studyUID;
	let seriesUID = req.query.seriesUID;
	let objectUID = req.query.objectUID;
	let len = req.query.len;
	let src = req.query.src;
	console.log(operation);
	if (operation == 'cfind') {
		console.log(req.query.operation);

		if (typeof studyUID != 'undefined') {
			dicomQRStudy(Pacs, studyUID, res);
		} else {
			dicomQR(Pacs, req, res);
		}

	} else if (operation == 'dicomfields') {

		getDicomWadoFields(Pacs, studyUID, seriesUID, objectUID);

	} else if (operation == 'binarydata') {

		getBinaryData(Pacs, studyUID, seriesUID, objectUID, len, src);

	} else {
		getWado(Pacs, studyUID, seriesUID, objectUID, req, res);

	}

});

function dicomQRStudy(pacs, study_IUID, response) {

	var extraFields = ' -r 00080060 -r 0008103E -r 00200011 -r 00201209';
	var command = process.env.PATH_BASE_DCM4CHE2 + "dcmqr -L " + process.env.AETITLE_GATEWAY + ":11114 -I " + pacs.getDicomServer() + " -q 0020000D=" + study_IUID + extraFields;
	let outputRes = [];
	console.log(command);
	const child = exec(command, defaults, (error, stdout, stderr) => {
		if (error) {
			return false;
			// throw error;
		}
		outputRes = stdout.split('\n')
		processResponse(outputRes, pacs.encoding, response);
	})
	if (process.env.DEBUG_LEVEL >= process.env.DEBUG_DUMP) {}



}

function dicomQR(pacs, request, response) {

	var extraFields = "-r 00080061 -r 00081030 -r 00100010 -r 00100021 -r 00100030 -r 00100040 -r 00201206 -r 00201208";;
	var qPatId = typeof request.query.patId != 'undefined' ?
		" -qPatientID=" + request.query.patId :
		"";
	var qStudyDate = typeof request.query.studyDate != 'undefined' ?
		" -q StudyDate=" + request.query.studyDate : "";
	var qFilter = qPatId + qStudyDate + " ";

	if (qFilter.length > 1) {
		var command = process.env.PATH_BASE_DCM4CHE2 + "dcmqr -L " + process.env.AETITLE_GATEWAY + ":11114 " + pacs.getDicomServer() + " -S" + qFilter + extraFields;
		var outputRes = [];
		const child = exec(command, defaults, (error, stdout, stderr) => {
			if (error) {
				return false;
			}
			outputRes = stdout.split('\n');
			processResponse(outputRes, pacs.encoding, response);
		});
	}

}

function processResponse(outputRes, encoding, response) {

	var pattern = /^((?:[0|1][0-9]|2[0-3])(?::[0-5][0-9]){2},[0-9]{3})\s([A-Z]+)\s+-\s(.+)$/;
	var dicom = [];
	// console.log(outputRes.length)
	each(outputRes, function (value, key, object) {
		var matches = value.match(pattern);
		if (matches != null) {

			var outputType = matches[2];
			var outputStr = matches[3];
			if (process.env.DEBUG_LEVEL >= process.env.DEBUG_DUMP) {
				// Mensajes de tipo INFO / ERROR
				var data = "<div style='color:red; margin:2em 0.5em;'>Patr&oacute;n reconocido (I)</div>";
				data += "<pre>" + matches + "</pre>";
				response.setHeader("Content-Type", "text/html");
				response.writeHead(response.statusCode);
				response.write(data);
				response.end();
			}
			if (outputType == 'ERROR') {
				response.send("ERROR")
				if (process.env.DEBUG_LEVEL >= process.env.DEBUG_INFO) {
					response.send(": outputStr");
				}
				response.send("<br>");
				return false;
			}
			var element = ''
			if (element = identifyPattern(outputStr)) {
				var lineNum = key + 1;
				xmlString = '';
				var df = ''
				while (outputRes[lineNum].length > 0) {
					if (process.env.DEBUG_LEVEL >= process.env.DEBUG_INFO) {
						response.send(outputRes[lineNum] + "br>\n")
					}
					if (df = processDicomField(outputRes[lineNum], encoding)) {
						xmlString += df['xmlString'] + "\n";
					}
					lineNum++;
				}
				element['xmlString'] = element['xmlPre'] + xmlString + element['xmlPost'];
				if (process.env.DEBUG_LEVEL >= process.env.DEBUG_DUMP) {
					respone.send(element["xmlString"]);
				}
				dicom.push(element);
			}

		}

	});

	if (process.env.DEBUG_LEVEL >= process.env.DEBUG_INFO) {} else if (process.env.DEBUG_LEVEL == process.env.DEBUG_NONE) {
		response.set('Content-Type', 'text/xml');
		var xmlstring = '<?xml version="1.0" encoding="' + process.env.XML_ENCODING + '"?>\n';
		var fechaAhora = moment().strftime("%Y%m%d%H%M%S%z");
		xmlstring += '<dicom datetime="' + fechaAhora + '">\n';
		each(dicom, function (value, key, object) {
			xmlstring += value["xmlString"];
		})
		xmlstring += "</dicom>\n";
		response.send(xmlstring);
		fs.writeFile('message.xml', xmlstring, (err) => {
			if (err) throw err;
			console.log('The file has been saved!');
		});
	}
}

function identifyPattern(testStr) {

	var patterns = [];
	let element = false;
	if (process.env.SHOW_REQUEST) {
		// Send Query Request using 1.2.840.10008.5.1.4.1.2.2.1/Study Root Query/Retrieve Information Model - FIND:
		patterns[process.env.QUERY_REQUEST_ROOT] = new RegExp('^Send Query Request using ([0-9]+(?:\.[0-9]+)+)\/'); //([[:alpha:][:space:]\/\-]+):$')
		// Send Query Request #1/3 using 1.2.840.10008.5.1.4.1.2.2.1/Study Root Query/Retrieve Information Model - FIND:
		patterns[process.env.QUERY_REQUEST] = new RegExp('^Send Query Request #([1-9][0-9]*)\/([1-9][0-9]*) using ([0-9]+(?:\.[0-9]+)+)\/'); //^Send Query Request #([1-9][0-9]*)\/([1-9][0-9]*) using ([0-9]+(?:\.[0-9]+)+)\/([[:alpha:][:space:]\/\-]+):$')
	}
	// Query Response #1:
	patterns[process.env.QUERY_RESPONSE_ROOT] = new RegExp('^Query Response #([1-9][0-9]*):$');
	// Query Response #1 for Query Request #1/3:
	patterns[process.env.QUERY_RESPONSE] = new RegExp('^Query Response #([1-9][0-9]*) for Query Request #([1-9][0-9]*)\/([1-9][0-9]*):$');
	var matches = [];
	each(patterns, function (value, key, object) {
		matches = testStr.match(value);
		if (matches != null) {
			element = [];
			element["xmlPre"] = "<!--" + matches[0] + "-->\n";
			element["type"] = key;
			switch (key) {
				case parseInt(process.env.QUERY_REQUEST_ROOT):
					element["tag"] = "request";
					element["xmlPre"] += "<" + element["tag"] + " qrim='" + matches[1] + "'>\n";
					break;
				case parseInt(process.env.QUERY_RESPONSE_ROOT):
					element["tag"] = "response";
					element["xmlPre"] += "<" + element["tag"] + " number='" + matches[1] + "'>\n";
					break;
				case parseInt(process.env.QUERY_REQUEST):
					element["tag"] = "qrequest";
					element["xmlPre"] += "<" + element["tag"] + " number='" + matches[1] + "' qrim='" + matches[3] + "'>\n";
					break;
				case parseInt(process.env.QUERY_RESPONSE):
					element["tag"] = "qresponse";
					element["xmlPre"] += "<" + element["tag"] + " number='" + matches[1] + "' qrequest='" + matches[2] + "'>\n";
					break;
				default:
					element["tag"] = "dummy";
					element["xmlPre"] += "<" + element["tag"] + ">\n";
					break;
			}
			element["xmlPost"] = "</" + element["tag"] + ">\n";
		}
	});
	return element
}

function processDicomField(dcmString, encoding) {

	if (process.env.DEBUG_LEVEL >= process.env.DEBUG_INFO) {}
	var matches = [];
	var pattern = /^\(([0-9A-F]{4}),([0-9A-F]{4})\)\s([A-Z]{2})\s#([0-9]+)\s\[([^\]]*)\]\s/ //(.*)$/
	matches = dcmString.match(pattern);
	if (matches != null) {
		// console.log(matches);
		var d = [];
		if (process.env.DEBUG_LEVEL >= process.env.DEBUG_DUMP) {}
		d['tagGroup'] = matches[1];
		d['tagElement'] = matches[2];
		d['valueRepr'] = matches[3];
		d['valueLength'] = matches[4];
		d['value'] = matches[5];
		d['tagName'] = matches[6];
		// Characters to convert to UTF-8: Elements with VR=PN, SH, LO, ST, LT, UT in the Data Set.
		var vr = d['valueRepr'];
		if (vr == 'PN' || vr == 'SH' || vr == 'LO' || vr == 'ST' || vr == 'LT' || vr == 'UT') {
			var iconv = new Iconv(encoding, process.env.XML_ENCODING);
			// console.log(vr, "=======>", d["value"]);
			// d["value"] = iconv.convert(d["value"]);
			// console.log(d);

			d["value"] = encodeXml(d["value"].toString());
			// console.log(d["value"]);
			//Convert non valid XML characters
		}
		var xmlString = "<!--" + d['tagName'] + "-->\n";
		xmlString += '<attr tag="' + d['tagGroup'] + d['tagElement'] + '" vr="' + d['valueRepr'] + '" len="' + d['valueLength'] + '">';
		xmlString += d['value'] + "</attr>";
		d['xmlString'] = xmlString;
	} else {
		d = false;
	}

	return d;
}

function encodeXml(s) {
	return s
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\t/g, "&#x9;")
		.replace(/\n/g, "&#xA;")
		.replace(/\r/g, "&#xD;");
}

function getWado(pacs, studyUID, seriesUID, objectUID, req, res) {

	let contentType = "image/jpeg";
	let wadocontent = 'jpeg';
	let fileType = '.jpeg';
	if (req.query.contentType == 'application/dicom') {
		contentType = "application/dicom";
		wadocontent = 'dcm';
		fileType = '.dcm';
	}
	pacs.setWado(process.env.WADOPROTOCOL, process.env.WADOHOST, process.env.WADOPORT, process.env.WADOSCRIPT);
	var requestType = 'wado';
	var wado_Base_url = pacs.getWadoUrl();
	var attachment = "attachment; filename=" + objectUID + fileType;
	return axios.request({
		responseType: 'arraybuffer',
		url: wado_Base_url,
		method: 'get',
		headers: {
			'Content-Type': contentType,
		},
		params: {
			studyUID: studyUID,
			seriesUID: seriesUID,
			objectUID: objectUID,
			requestType: requestType,
			contentType: contentType
		}
	}).then((result) => {
		const outputFilename = './tmp/' + attachment;
		res.setHeader("Content-Length", result.data.length);
		res.setHeader("Content-Type", contentType);
		res.setHeader("Content-Disposition", attachment);
		res.write(result.data, "binary");
		res.end();
		return true;
	}).catch(err=>{
		console.log('error');
		let filePath = "./tmp/" + objectUID + fileType;
		let file = fs.readFileSync(filePath)
		const stats = fs.statSync(filePath)
		var actachment = "attachment; filename=" + objectUID + fileType; //tempnam.tempnamSync('tmp');
		console.log(stats.size);
		res.setHeader("Content-Length", stats.size);
		res.setHeader("Content-Type", contentType);
		res.setHeader("Content-Disposition", actachment);
		res.write(file, "binary");
		res.end();
	});

	// pacs.setWado(process.env.WADOPROTOCOL, process.env.WADOHOST, process.env.WADOPORT, process.env.WADOSCRIPT);
	// let uriWado = pacs.getWadoCommand(studyUID, seriesUID, objectUID, wadocontent);
	// if (typeof req.query.rows != "undefined" && typeof req.query.cols != "undefined") {
	// 	uriWado += " -columns "; + req.query.rows + " -rows "; + req.query.cols;
	// 	// uriWado += "&rows=" + process.env.THUMBNAIL_SIZE + "&cols=" + process.env.THUMBNAIL_SIZE;

	// }
	// if (process.env.RETRIEVE_LOCAL) {
	// 	let tmpFWado = '\\tmp' //tempnam.tempnamSync("\\tmp", "dicom_")
	// 	tmpFWado = appRoot + tmpFWado //.replace('/', '\\');
	// 	if (getLocalWado(uriWado, tmpFWado)) {
	// 		let filePath = "./tmp/" + objectUID + fileType;
	// 		let file = fs.readFileSync(filePath)
	// 		const stats = fs.statSync(filePath)
	// 		var actachment = "attachment; filename=" + objectUID + fileType; //tempnam.tempnamSync('tmp');
	// 		console.log(stats.size);
	// 		res.setHeader("Content-Length", stats.size);
	// 		res.setHeader("Content-Type", contentType);
	// 		res.setHeader("Content-Disposition", actachment);
	// 		res.write(file, "binary");
	// 		res.end();
	// 	} else {

	// 	}
	// }
}

function getLocalWado(uriWado, tmpFWado) {
	let getOk = false;
	let numTry = 0;
	let maxTry = 3;
	let delayTry = 1;
	while (getOk == false && numTry < maxTry) {
		if (numTry > 0) {
			sleep.sleep(delayTry)
		}
		let retrieveCommand = process.env.PATH_WGET + ' ' + uriWado + ' -dir ' + tmpFWado // ' --server-response 2> /dev/stdout | grep Content-Type | awk -F Content-Type:  {print $2}'
		let outputCommand = [];
		console.log(retrieveCommand)
		try {
			outputCommand = execSync(retrieveCommand, defaults);
		} catch (err) {
			return false;
		}
		if (outputCommand.search("Error") == -1) getOk = true
		numTry++
	}
	return getOk
}
