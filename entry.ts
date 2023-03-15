import Bot from "./library/bot";
import dotenv from "dotenv";

const parsed = dotenv.config().parsed;
new Bot(parsed.TOKEN, parsed.APP_ID);