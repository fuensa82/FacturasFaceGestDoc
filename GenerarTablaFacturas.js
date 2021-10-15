// Includes
var fs = require("fs");
var _ = require("underscore");
var jsonfile = require('jsonfile');
var xmlQuery = require('xml-query');
var XmlReader = require('xml-reader');
const { exit } = require("process");

//Rutas de los fichero
var rutaAbsoluta='//sev5-fuensalida/GIA/bdremota/FACE/p4506600h'; 
var fileFacturasProcesadas = 'FacturasProcesadas/facturas.json';
var fileFacturasGestDoc = 'FacturasProcesadas/facturasGesDoc.csv';
var fileFacturasGestDocGIA = '//sev5-fuensalida/GIA/FacturasCopiasParaGestDoc/csv/facturasGesDoc.csv';
var fileFacturasGestDocGIAerror = '//sev5-fuensalida/GIA/FacturasCopiasParaGestDoc/csv/facturasGesDocAlt.csv';
var rutaFacturasCopias = '//sev5-fuensalida/GIA/FacturasCopiasParaGestDoc';

//Array para ficheros
var arrayFacturas=new Array();

//comenzamos
//Inicializacion de variables
var textoReferencia="FACTURA ELECTRONICA POR IMPORTE DE"
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

var listaFacturasProcesadas;
try{
	listaFacturasProcesadas=jsonfile.readFileSync(__dirname+"\\"+fileFacturasProcesadas);
}catch(err){
	console.log("Error: "+err);
	exit(0);
}
	

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
	rutaAbsoluta = rutaAbsoluta.replace(',', '.'); //Si viene con comas lo cambiamos por puntos ya que no lee bien los puntos y los está tranformado en comas.
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

/** se pretenden registrar solo los xsig **/
function tartarFicheros(ruta,dirATratar, anio, cif){
	if(!facturaProcesada(ruta, anio)){
		var datos={};
		dirATratar.forEach(element => {
			var ext=element.split(".")[element.split(".").length-1];
			if(ext=="xsig"){
				datos=leerDatosXML(ruta+element);
				var detalle=fs.statSync(ruta+element);
				//Añadimos la fecha en formato yyyymmddHHmmssmm para poder ordenar alfabéticamente y que salgan por orden de fecha
				var name=""+detalle.mtime.getFullYear()+
					rellenarIzq((detalle.mtime.getMonth()+1), 2, "0")+
					rellenarIzq(detalle.mtime.getDay(), 2, "0")+
					rellenarIzq(detalle.mtime.getHours(), 2, "0")+
					rellenarIzq(detalle.mtime.getMinutes(), 2, "0")+
					rellenarIzq(detalle.mtime.getSeconds(), 2, "0")+
					rellenarIzq(detalle.mtime.getMilliseconds(), 3, "0");

				fs.copyFileSync(ruta+element, rutaFacturasCopias+"/"+name+"_"+element);
				arrayFacturas.push({
					"cif":cif,
					"nombre":datos.nomProveedor,
					"ruta":ruta+element,
					"referencia":"FACTURA ELECTRONICA POR IMPORTE DE "+tratarImporte(datos.importe)+" Euros",
					"orden":name
				});
			}
		});
	}
}

/**
 * 
 * @param {Numero que se quiere rellenar por la izquierda} num 
 * @param {Cuanto medirá la cadena resultante} longitud 
 * @param {Caracter con el que se rellenará} relleno 
 */
function rellenarIzq(num, longitud, relleno){
	num=""+num;
	while(num.length<longitud){
		num=""+relleno+num;
	}
	return num;
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
/**
 * Lee el xsig para sacar los datos de Importe, fecha de la factura y numero de factura
 * @param {Ruta del archivo XML a leer} ruta 
 */
function leerDatosXML(ruta){
	var xmlAux=fs.readFileSync(ruta,'utf8');
	var xml = XmlReader.parseSync(xmlAux);
	var datos={
		"importe":xmlQuery(xml).find("TotalExecutableAmount").find("TotalAmount").text(),
		"fecha":xmlQuery(xml).find("IssueDate").text(),
		"numFactura":xmlQuery(xml).find("InvoiceNumber").text(),
		"nomProveedor":xmlQuery(xml).find("SellerParty").find("CorporateName").text(),
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
 * Genera un fichero ERROR.txt con el mensaje de error
 * @param {Mensaje de error} error 
 */
function generarError(error){ 
	var fileError = '//sev5-fuensalida/GIA/FacturasCopiasParaGestDoc/csv/ERROR.txt';
	console.error(error);
	/**
	 * Añadimos la traza de cuantas facturas se han procesado antes del error.
	 */
	console.log("*****ERROR******");
	console.log("Total ficheros: "+total);
	console.log("Total ficheros Nuevos "+anioAnt+": "+total1);
	console.log("Total ficheros Nuevos "+anio+": "+total2);
	error+="Total ficheros: "+total+"\n"+
		"Total ficheros Nuevos "+anioAnt+": "+total1+
		"Total ficheros Nuevos "+anio+": "+total2;

	fs.appendFile(fileError, error, (err) => {
		if (err) {
			console.error(err);
			return;
		};
		console.log("Fichero de ERROR");
	});
	
}
function getHoy(){
	var dt = new Date();
	var month = dt.getMonth()+1;
	var day = dt.getDate();
	var year = dt.getFullYear();
	return day + '-' + month + '-' + year;
}

//Comenzamos la lectura de los directorios
try {  
	total=0;
	leerArbolCompleto(rutaAbsoluta+"/"+anioAnt,"", anioAnt,"");
	var total1=totalNuevas;
	totalNuevas=0;
	leerArbolCompleto(rutaAbsoluta+"/"+anio,"",anio,"");
	var total2=totalNuevas;
	//Ordenamos el array
	arrayFacturas.sort(function(a,b){
		return a.orden-b.orden;
	});

	arrayFacturas.forEach(element => {
		tablaForGestDoc+=
			element.cif+";"+
			element.nombre+";"+
			element.ruta+";"+
			element.referencia+";"+
			hoy+" "+hora+"\r\n";
	});

	
	console.log("\nTotal ficheros: "+total);
	console.log("\nTotal ficheros Nuevos "+anioAnt+": "+total1);
	console.log("\nTotal ficheros Nuevos "+anio+": "+total2);

	

	fs.appendFile(fileFacturasGestDoc, tablaForGestDoc, (err) => {
		if (err) {
			console.error(err);
			generarError("\nCSV de facturas locales: "+err);
			return;
		};
		console.log("\nFichero de procesado local creado");
	});

	fs.appendFile(fileFacturasGestDocGIA, tablaForGestDoc, (err) => {
		if (err) {
			console.error(err);
			generarError("\nCSV de facturas en GIA: "+err);
			fs.appendFile(fileFacturasGestDocGIAerror, tablaForGestDoc,(err)=>{
				if(err){
					console.log("\nError al escribir en fichero GIA alternativo");
				}
			});
			return;
		};
		console.log("\nFichero GIA de procesado creado");
	});

	/**
	 * Se guarda la lista de facturas procesadas para no volver a procesarlas. Se hace despues de que los
	 * CSV se hayan creado correctamente ya que es el paso más delicado.
	 */
	fs.writeFile(fileFacturasProcesadas, JSON.stringify(listaFacturasProcesadas, null,3), (err) => {
		if (err) {
			console.error(err);
			generarError("\nLista Facturas procesadas: "+err);
			return;
		};
		console.log("Fichero de lista creado");
	});
}catch(error) {
	generarError("\nGeneral: "+error);
	
  
}

var fin=new Date().getTime();
console.log("Tiempo total: "+(fin-inicio));
