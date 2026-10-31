import { env } from "../config/env.js";

export const isAdminUser = (user) => env.adminEmails.includes(user?.email?.toLowerCase());