import type { Request, Response } from "express";
import { sendSuccess } from "../../utils/response";
import * as availabilityService from "./availability.service";
import * as servicesService from "./services.service";
import type { AvailabilityQuery, ListServicesQuery } from "./services.validation";

// req.query has already been validated and converted by the validate middleware.

export async function list(req: Request, res: Response): Promise<void> {
  const { services, meta } = await servicesService.listServices(req.query as unknown as ListServicesQuery);
  sendSuccess(res, services, { meta: { ...meta } });
}

export async function categories(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, await servicesService.listCategories());
}

export async function detail(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await servicesService.getActiveServiceOrThrow(req.params.id));
}

export async function availability(req: Request, res: Response): Promise<void> {
  const { date } = req.query as unknown as AvailabilityQuery;
  sendSuccess(res, await availabilityService.getAvailability(req.params.id, date));
}
