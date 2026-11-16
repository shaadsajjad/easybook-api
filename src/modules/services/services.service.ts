import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { isUuid } from "../../utils/uuid";
import { serviceSelect, toServiceDto, type PaginationMeta, type ServiceDto } from "./services.types";
import type { ListServicesQuery } from "./services.validation";

export async function listServices(
  query: ListServicesQuery,
): Promise<{ services: ServiceDto[]; meta: PaginationMeta }> {
  const { search, category, featured, minPrice, maxPrice, page, limit } = query;

  // Only active services are ever visible. Each filter is added only when it was sent.
  const where: Prisma.ServiceWhereInput = {
    isActive: true,
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(category && { category: { equals: category, mode: "insensitive" } }),
    ...(featured !== undefined && { isFeatured: featured }),
    ...((minPrice !== undefined || maxPrice !== undefined) && {
      price: { gte: minPrice, lte: maxPrice },
    }),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.service.findMany({
      where,
      select: serviceSelect,
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.service.count({ where }),
  ]);

  return {
    services: rows.map(toServiceDto),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function listCategories(): Promise<string[]> {
  const rows = await prisma.service.findMany({
    where: { isActive: true },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((row) => row.category);
}

// Inactive services behave exactly like missing ones. Also used by the appointments module.
export async function getActiveServiceOrThrow(id: string): Promise<ServiceDto> {
  const service = isUuid(id)
    ? await prisma.service.findFirst({ where: { id, isActive: true }, select: serviceSelect })
    : null;
  if (!service) {
    throw new ApiError(404, "Service not found");
  }
  return toServiceDto(service);
}
