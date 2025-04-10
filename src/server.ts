import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const APP = express();

APP.use(cors());
APP.use(express.json());
APP.use(express.urlencoded({ extended: false }));

const PORT = process.env.PORT || 5000;

APP.listen(PORT, () => console.log(`Server running on ${PORT}`));