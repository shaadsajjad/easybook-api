import type { Request, Response } from "express";
import { requireUser } from "../../middleware/authenticate";
import { sendSuccess } from "../../utils/response";
import * as appointmentsService from "./appointments.service";
import type { CreateAppointmentInput, ListAppointmentsQuery } from "./appointments.validation";

export async function create(req: Request, res: Response): Promise<void> {
  const appointment = await appointmentsService.createAppointment(
    requireUser(req).id,
    req.body as CreateAppointmentInput,
  );
  sendSuccess(res, appointment, { status: 201, message: "Appointment booked" });
}

export async function list(req: Request, res: Response): Promise<void> {
  const appointments = await appointmentsService.listAppointments(
    requireUser(req).id,
    req.query as unknown as ListAppointmentsQuery,
  );
  sendSuccess(res, appointments);
}

export async function detail(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await appointmentsService.getAppointment(requireUser(req).id, req.params.id));
}

export async function cancel(req: Request, res: Response): Promise<void> {
  const appointment = await appointmentsService.cancelAppointment(requireUser(req).id, req.params.id);
  sendSuccess(res, appointment, { message: "Appointment cancelled" });
}
