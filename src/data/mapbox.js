require("dotenv").config();

module.exports = async () => {
  return process.env.MAPBOX_ACCESS_TOKEN;
};
