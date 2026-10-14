// Corre antes de cargar la app: los tests usan su propia base, nunca la de desarrollo
process.env.DB_NAME = "postulapp_test";
process.env.JWT_SECRET = "test-secret";
