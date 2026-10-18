// CONEXIÓN CON LA BASE DE DATOS POSTGRESQL (Supabase)
// Los datos de conexión vienen de la variable de entorno DATABASE_URL,
// así la contraseña nunca se sube a GitHub.

const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
    console.error("Falta la variable de entorno DATABASE_URL (cadena de conexión de Supabase)");
    process.exit(1);
}

// Un Pool mantiene varias conexiones abiertas y las reutiliza
const conexion = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }      // Supabase exige conexión cifrada
});

// Comprobar al arrancar que la conexión funciona
conexion.query("SELECT NOW()", function (err) {
    if (err) {
        console.error("Error al conectar con Supabase:", err.message);
    } else {
        console.log("Conectado a la base de datos de Supabase");
    }
});

module.exports = conexion;