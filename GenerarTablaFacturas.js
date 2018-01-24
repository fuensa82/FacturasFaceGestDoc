var fs = require("fs");
var _ = require("underscore");
var inicio = new Date().getTime();
var jsonfile = require('jsonfile');
var anio = new Date().getFullYear();
var anioAnt = anio-1;

var rutaAbsoluta='//sev5-fuensalida/GIA/bdremota/FACE/p4506600h';
var fileFacturasProcesadas = 'FacturasProcesadas/facturas.json';
var fileFacturasGestDoc = 'FacturasProcesadas/facturasGesDoc.csv';

var listaFacturasProcesadas=jsonfile.readFileSync(fileFacturasProcesadas);
var tablaForGestDoc="";

//ejemplo para acceder a la fecha de una factura
//console.log(listaFacturasProcesadas.facturasFace["2017"].cifs["03885536"].factura["FA21"].fechaProcesado);

var profundidad=0; //La profundidad de directorios para llegar a la factura es 4. Año, CIF, Factura y ya el PDF o xsig
var profundidadCif=2; //numero de directorios hasta llegar al directorio del CIF
var total=0; //Número de facturas encontradas
var totalNuevas=0;
var hoy=getHoy();

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
		//if()
		if(fs.statSync(rutaAbsoluta+"/"+list[i]).isFile()){
		//if(elem.length>=2){//ya estamos en los ficheros
			total++;
			tartarFicheros(rutaAbsoluta+"/", list, anio, cifTratado);
			fin = true;
		}else{
			//console.log(profundidad+" "+espacios+"Directorio "+elem);
			leerArbolCompleto(rutaAbsoluta+"/"+elem,espacios+"  ", anio, cifTratado);
		}
	}
	profundidad--;
	return;
}

/** se pretenden registrar todos los ficheros **/
function tartarFicheros(ruta,dirATratar, anio, cif){
	if(!facturaProcesada(ruta, anio)){
		dirATratar.forEach(element => {
			tablaForGestDoc+=cif+";"+";"+element+"\r\n";
		});
	}
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
		listaFacturasProcesadas.facturasFace[anioN][ruta]=hoy;
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

total=0;
leerArbolCompleto(rutaAbsoluta+"/"+anioAnt,"", anioAnt,"");
var total1=totalNuevas;
totalNuevas=0;
leerArbolCompleto(rutaAbsoluta+"/"+anio,"",anio,"");
var total2=totalNuevas;
console.log("Total ficheros: "+total);
console.log("Total ficheros Nuevos "+anioAnt+": "+total1);
console.log("Total ficheros Nuevos "+anio+": "+total2);
//console.log("Tabla GestDoc "+tablaForGestDoc);
//jsonfile.writeFileSync(file, listaFacturasProcesadas);
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
