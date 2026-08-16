import "./loadEnv.js";
import { PrismaClient } from "@prisma/client";
import { applyDatabaseUrl } from "./databaseUrl.js";

applyDatabaseUrl();

const prisma = new PrismaClient();

export default prisma;
