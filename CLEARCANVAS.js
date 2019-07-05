class PACS {
	// DICOM setup
	constructor(AETitle, host, port) {
		this.AETitle = AETitle;
		this.host = host;
		this.port = port;
		this.lang = 'en_US'; // No need to change
		this.encoding = 'iso-8859-1'; // May need to change to UTF-8
		this.wadoProtocol = 'http';
		this.wadoHost = host;
		this.wadoPort = port;
	}

	getDicomServer() {
		dicomServer = this.AETitle + '@' + this.host + ':' + this.port;
		return dicomServer;
	}

	/**
	 * Force Dicom Q/R execution under a given locale to deal properly with non-ascii characters
	 */

	getLocale() {
		return this.lang + '.' + this.encoding;
	}

	/**
	 * In some environments Wado server runs independently of Dicom server
	 */

	setWado(wadoProtocol, wadoHost, wadoPort, wadoScript) {
		this.wadoProtocol = wadoProtocol;
		this.wadoHost = wadoHost;
		this.wadoPort = wadoPort;
		this.wadoScript = wadoScript;
	}

	setWadoScript(wadoScript) {
		this.wadoScript = wadoScript;
	}

	getUriWado(studyUID, seriesUID, objectUID) {
		// Additional parameters ??? contentType transferSyntax (UID)
		codeBase = '{this->wadoProtocol}://{this->wadoHost}:{this->wadoPort}/{this->wadoScript}?';
		queryString = 'requestType=WADO&studyUID={studyUID}&seriesUID={seriesUID}&objectUID={objectU' + 'ID}';
		uriWado = codeBase + queryString;
		return uriWado;
	}
}

export default class CLEARCANVAS extends PACS {
	constructor(AETitle, host, port) {
		super(AETitle, host, port);
		this.wadoPort = '1000';
		this.setWadoScript('wado/'.AETitle);
	}
}
