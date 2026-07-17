import { ok, error } from "./lib/response";
import { getAvailability } from "../lib/scheduler";

export async function onRequestGet(context) {

    try {

        const availability = await getAvailability(context.env);

        return ok(availability);

    } catch (err) {

        return error(err.message);

    }

}