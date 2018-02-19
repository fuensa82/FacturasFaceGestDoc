// Includes
var fs = require("fs");
var _ = require("underscore");
var jsonfile = require('jsonfile');
var xmlQuery = require('xml-query');
var XmlReader = require('xml-reader');

//Rutas de los ficheros
var rutaAbsoluta='//sev5-fuensalida/GIA/bdremota/FACE/p4506600h';
var fileFacturasProcesadas = 'FacturasProcesadas/facturas.json';
var fileFacturasGestDoc = 'FacturasProcesadas/facturasGesDoc.csv';
var rutaFacturasCopias = '//sev5-fuensalida/GIA/FacturasCopiasParaGestDoc';

//comenzamos
//Inicializacion de variables

var tablaForGestDoc="";
var inicio = new Date().getTime();
var anio = new Date().getFullYear();
var anioAnt = anio-1;
var profundidad=0; //La profundidad de directorios para llegar a la factura es 4. Año, CIF, Factura y ya el PDF o xsig
var profundidadCif=2; //numero de directorios hasta llegar al directorio del CIF
var total=0; //Número de facturas encontradas
var totalNuevas=0;
var hoy=getHoy();
var hora=getHoraActual();
var listaFacturasProcesadas=jsonfile.readFileSync(fileFacturasProcesadas);

/**
 * Calcula la hora en formato bonito
 */
function getHoraActual(){
	var date = new Date();
	var hour = date.getHours();
	hour = (hour < 10 ? "0" : "") + hour;
	var min  = date.getMinutes();
	min = (min < 10 ? "0" : "") + min;
	var sec  = date.getSeconds();
	sec = (sec < 10 ? "0" : "") + sec;
	return hour + ":" + min + ":" + sec;
}
/**
 * 
 * @param {*} rutaAbsoluta 
 * @param {*} espacios  Son solo por si imprimimos el arbol bonito
 * @param {*} anio 
 * @param cifTratado Cif del proveedor que se va a tratar. Puede ir en blanco si no se sabe qué proveedor es.
 */
function leerArbolCompleto(rutaAbsoluta, espacios, anio, cifTratado){
	var list=fs.readdirSync(rutaAbsoluta);
	profundidad++;
	if(profundidad==profundidadCif){
		var elem=rutaAbsoluta.split('/');
		var cif=elem[elem.length-1];
		cifTratado=cif;
	}
	var fin=false;
	for(var i=0;i<list.length && !fin;i++){
		var elem=list[i].split('.');
		if(fs.statSync(rutaAbsoluta+"/"+list[i]).isFile()){
			total++;
			tartarFicheros(rutaAbsoluta+"/", list, anio, cifTratado);
			fin = true;
		}else{
			leerArbolCompleto(rutaAbsoluta+"/"+elem,espacios+"  ", anio, cifTratado);
		}
	}
	profundidad--;
	return;
}

/** se pretenden registrar todos los ficheros **/
function tartarFicheros(ruta,dirATratar, anio, cif){
	if(!facturaProcesada(ruta, anio)){
		var datos={};
		dirATratar.forEach(element => {
			var ext=element.split(".")[element.split(".").length-1];
			if(ext=="xsig"){
				datos=leerDatosXML(ruta+element);
				fs.copyFileSync(ruta+element, rutaFacturasCopias+"/FAC_"+hoy+"_"+element);
				tablaForGestDoc+=
					cif+";"
					+ruta+element+";"
					+"FACTURA POR IMPORTE DE "+tratarImporte(datos.importe)+" Euros;"
					+hoy+" "+hora+"\r\n";
			}
		});/*
		dirATratar.forEach(element => {
			tablaForGestDoc+=
				cif+";"
				+";"
				+ruta+element+";"
				+datos.numFactura+";"
				+datos.fecha+";"
				+datos.importe+";"
				+hoy+" "+hora+"\r\n";
		});*/
	}
}

/**
 * La funcion transforma en importe en formato 1234.00 en 1.234,00
 * @param {Importe de la factura pero en texto, con un punto separando los decimales} importe 
 */
function tratarImporte(importe){
	var imp=importe.split(".");
	if (imp[0].length>6){
		imp[0]=imp[0].substring(0,imp[0].length-6)+"."
			  +imp[0].substring(imp[0].length-6,imp[0].length-3)+"."
			  +imp[0].substring(imp[0].length-3);
	}else if(imp[0].length>3){
		imp[0]=imp[0].substring(0,imp[0].length-3)+"."
			  +imp[0].substring(imp[0].length-3);
	}
	return imp[0]+","+imp[1];
}

function leerDatosXML(ruta){
	var xmlAux=fs.readFileSync(ruta,'utf8');
	var xml = XmlReader.parseSync(xmlAux);
	var datos={
		"importe":xmlQuery(xml).find("TotalExecutableAmount").find("TotalAmount").text(),
		"fecha":xmlQuery(xml).find("IssueDate").text(),
		"numFactura":xmlQuery(xml).find("InvoiceNumber").text()
	};
	return datos;
	
}
/**
 * Comprueba si la factura ya se procesó. FALSE si la factura no se ha procesado. Tambien
 * guarda la factura en la lista de las facturas ya procesadas
 * @param {*} ruta 
 * @param {*} anio 
 */
function facturaProcesada(ruta, anio){
	anioN="anio_"+anio+"_F";
	if(listaFacturasProcesadas.facturasFace[anioN]==undefined){
		listaFacturasProcesadas.facturasFace[anioN]={};
	}
	if(listaFacturasProcesadas.facturasFace[anioN][ruta]==undefined){
		listaFacturasProcesadas.facturasFace[anioN][ruta]=hoy+" "+hora;
		totalNuevas++;
		return false;
	}else{
		return true;
	}
	
}
/**
 * 
 * @param {*} tipo 
 * @param {*} mensaje 
 */
function generarError(tipo, mensaje){ 
	if(tipo==1){
		mensaje="ERROR: "+mensaje+"\r\n";
	}
	var fileError="Error_"+getHoy()+".log";

	fs.appendFileSync(fileError, mensaje);
	
}
function getHoy(){
	var dt = new Date();
	var month = dt.getMonth()+1;
	var day = dt.getDate();
	var year = dt.getFullYear();
	return day + '-' + month + '-' + year;
}

//Comenzamos la lectura de los directorios
total=0;
leerArbolCompleto(rutaAbsoluta+"/"+anioAnt,"", anioAnt,"");
var total1=totalNuevas;
totalNuevas=0;
leerArbolCompleto(rutaAbsoluta+"/"+anio,"",anio,"");
var total2=totalNuevas;

console.log("Total ficheros: "+total);
console.log("Total ficheros Nuevos "+anioAnt+": "+total1);
console.log("Total ficheros Nuevos "+anio+": "+total2);

fs.writeFile(fileFacturasProcesadas, JSON.stringify(listaFacturasProcesadas, null,3), (err) => {
    if (err) {
        console.error(err);
        return;
    };
    console.log("Fichero de lista creado");
});

fs.appendFile(fileFacturasGestDoc, tablaForGestDoc, (err) => {
    if (err) {
        console.error(err);
        return;
    };
    console.log("Fichero de procesado creado");
});
var fin=new Date().getTime();
console.log("Tiempo total: "+(fin-inicio));
