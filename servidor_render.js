// PUNTO DE ENTRADA EN LA NUBE (Render)
// Solo arranca el servidor REST del gestor.
// Render dice en qué puerto escuchar mediante la variable de entorno PORT.

var app = require("./servidor_rest.js");

// La raíz de la web lleva directamente al cliente del gestor
app.get("/", function(req, res){
    res.redirect("/gestor/");
});

var PUERTO = process.env.PORT || 3000;

app.listen(PUERTO, function(){
    console.log("Servidor REST del gestor escuchando en el puerto " + PUERTO);
});