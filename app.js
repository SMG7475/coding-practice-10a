const express = require("express");
const path = require("path");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const jsonMiddleware = express.json();
app.use(jsonMiddleware);
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();
const convertDistrict = (district) => {
  return {
    districtId: `$(district.district_id)`,
    districtName: `$(district.district_name)`,
    stateId: `$(district.state_id)`,
    cases: `$(district.cases)`,
    cured: `$(district.cured)`,
    active: `$(district.active)`,
    deaths: `$(district.deaths)`,
  };
};
//login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
//API1
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT state_id AS stateId,
    state_name AS stateName,
    population
    FROM state;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(statesArray);
});

//API 3
app.post(`/districts/`, authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
    INSERT INTO
      district(district_name, state_id, cases,cured,active,deaths)
    VALUES
      (
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
      );`;

  const dbResponse = await db.run(addDistrictQuery);
  const district_id = dbResponse.lastID;
  response.send("District Successfully Added");
});
//api 2
app.get(`/states/:stateId/`, authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT
    state_id AS stateId,
    state_name AS stateName,
    population
    FROM
      state
    WHERE
      state_id = ${stateId};`;
  const state = await db.get(getStateQuery);
  response.send(state);
});
//API 4
app.get(
  `/districts/:districtId/`,
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT
      district_id as districtId,
      district_name as districtName,
      state_id as stateId,
      cases,cured,active,deaths
    FROM
      district
    WHERE
      district_id = ${districtId};`;
    const district = await db.get(getDistrictQuery);
    response.send(district);
  }
);
//API5
app.delete(
  `/districts/:districtId/`,
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM
      district
    WHERE
      district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);
//API6
app.put(
  `/districts/:districtId/`,
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
    UPDATE
      district(district_name, state_id, cases,cured,active,deaths)
    SET
      (
        district_name='${districtName}',
        state_id=${stateId},
        cases=${cases},
        cured=${cured},
        active=${active},
        deaths=${deaths}
      )
      WHERE district_id=${districtId};`;

    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);
//API 7
app.get(
  `/states/:stateId/stats/`,
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `
    SELECT SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id=${stateId}
    GROUP BY state_id`;
    const statsArray = await db.get(getStatsQuery);
    response.send(statsArray);
  }
);
//API 8
app.get(
  `/districts/:districtId/details/`,
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getStateNameQuery = `
    SELECT
      state_name AS stateName
    FROM
      state
    WHERE
      state_id = (SELECT state_id
        FROM district
        WHERE district_id=${districtId})`;
    const stateNames = await db.get(getStateNameQuery);
    response.send(stateNames);
  }
);
module.exports = app;
