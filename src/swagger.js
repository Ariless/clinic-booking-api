const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const swaggerUi = require("swagger-ui-express");

const openApiPath = path.join(__dirname, "..", "openapi", "openapi.yaml");

function loadOpenApiDocument() {
  const raw = fs.readFileSync(openApiPath, "utf8");
  return yaml.load(raw);
}

function mountSwagger(app) {
  const document = loadOpenApiDocument();

  app.get("/api/openapi.yaml", (_req, res) => {
    res.type("text/yaml; charset=utf-8");
    res.send(fs.readFileSync(openApiPath, "utf8"));
  });

  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(document, {
      customSiteTitle: "Clinic booking API — docs",
    })
  );
}

module.exports = { mountSwagger };
