// Demo data for development and the Flutter app. Tests never use it.
// Safe to run repeatedly: services and the demo user are upserted by a stable key,
// and the demo user's appointments are recreated relative to today.
//
// Run with: npm run seed   (or: npx prisma db seed)

import { AppointmentStatus, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { env } from "../src/config/env";
import { prisma } from "../src/config/prisma";
import { addDays, addMinutes, toZonedDateString, zonedTimeToUtc } from "../src/utils/time";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "Demo1234";

const image = (photoId: string): string =>
  `https://images.unsplash.com/photo-${photoId}?w=800&q=80&auto=format&fit=crop`;

// Fixed ids are the stable upsert key, so reruns update rows instead of duplicating them.
// id is required here (not optional as in Prisma.ServiceCreateInput): it is the stable upsert key.
const services: (Prisma.ServiceCreateInput & { id: string })[] = [
  {
    id: "5e000000-0000-4000-8000-000000000001",
    name: "Classic Haircut",
    description: "A tailored haircut with wash, styling and a hot towel finish.",
    price: "500.00",
    durationMinutes: 30,
    imageUrl: image("1503951914875-452162b0f3f1"),
    category: "Hair & Beauty",
    isFeatured: true,
  },
  {
    id: "5e000000-0000-4000-8000-000000000002",
    name: "Hair Colouring",
    description: "Full hair colour by a senior stylist, including consultation and aftercare advice.",
    price: "2500.00",
    durationMinutes: 120,
    imageUrl: image("1560066984-138dadb4c035"),
    category: "Hair & Beauty",
  },
  {
    id: "5e000000-0000-4000-8000-000000000003",
    name: "Manicure & Pedicure",
    description: "Nail shaping, cuticle care, a relaxing hand and foot massage, and polish.",
    price: "1200.00",
    durationMinutes: 60,
    imageUrl: image("1604654894610-df63bc536371"),
    category: "Hair & Beauty",
  },
  {
    id: "5e000000-0000-4000-8000-000000000004",
    name: "Full Body Massage",
    description: "A 60-minute Swedish massage to release tension and improve circulation.",
    price: "3000.00",
    durationMinutes: 60,
    imageUrl: image("1544161515-4ab6ce6db874"),
    category: "Wellness",
    isFeatured: true,
  },
  {
    id: "5e000000-0000-4000-8000-000000000005",
    name: "Spa Facial",
    description: "Deep-cleansing facial with exfoliation, mask and hydration for all skin types.",
    price: "1800.00",
    durationMinutes: 60,
    imageUrl: image("1600334089648-b0d9d3028eb2"),
    category: "Wellness",
  },
  {
    id: "5e000000-0000-4000-8000-000000000006",
    name: "Personal Training Session",
    description: "One-to-one workout with a certified trainer, planned around your goals.",
    price: "1500.00",
    durationMinutes: 60,
    imageUrl: image("1571019613454-1cb2f99b2d8b"),
    category: "Wellness",
  },
  {
    id: "5e000000-0000-4000-8000-000000000007",
    name: "Home Deep Cleaning",
    description: "Top-to-bottom cleaning of a 2-bedroom flat, including kitchen and bathrooms.",
    price: "4000.00",
    durationMinutes: 180,
    imageUrl: image("1581578731548-c64695cc6952"),
    category: "Home Services",
    isFeatured: true,
  },
  {
    id: "5e000000-0000-4000-8000-000000000008",
    name: "Electrical Repair",
    description: "A licensed electrician fixes switches, sockets, lights and wiring faults.",
    price: "800.00",
    durationMinutes: 60,
    imageUrl: image("1621905251189-08b45d6a269e"),
    category: "Home Services",
  },
  {
    id: "5e000000-0000-4000-8000-000000000009",
    name: "Plumbing Service",
    description: "Leak repairs, tap and pipe fixes, and drain unblocking by an experienced plumber.",
    price: "900.00",
    durationMinutes: 60,
    imageUrl: image("1585704032915-c3400ca199e7"),
    category: "Home Services",
  },
  {
    id: "5e000000-0000-4000-8000-000000000010",
    name: "General Health Check-up",
    description: "Consultation with a GP, including blood pressure, BMI and basic blood tests.",
    price: "2000.00",
    durationMinutes: 30,
    imageUrl: image("1576091160550-2173dba999ef"),
    category: "Health",
    isFeatured: true,
  },
];

async function seedServices(): Promise<void> {
  for (const service of services) {
    const { id, ...data } = service;
    await prisma.service.upsert({ where: { id }, update: data, create: service });
  }
  console.log(`Upserted ${services.length} services`);
}

async function seedDemoUser(): Promise<string> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, env.BCRYPT_ROUNDS);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: "Demo User", passwordHash },
    create: { name: "Demo User", email: DEMO_EMAIL, passwordHash, phone: "+8801700000000" },
  });
  console.log(`Upserted demo user ${DEMO_EMAIL}`);
  return user.id;
}

async function seedDemoAppointments(userId: string): Promise<void> {
  // Recreate the demo user's bookings so their dates stay relative to "today".
  await prisma.appointment.deleteMany({ where: { userId } });

  const today = toZonedDateString(new Date());
  const samples: { serviceIndex: number; dayOffset: number; hour: number; status: AppointmentStatus; notes?: string }[] = [
    { serviceIndex: 0, dayOffset: -7, hour: 10, status: AppointmentStatus.COMPLETED },
    { serviceIndex: 3, dayOffset: 2, hour: 11, status: AppointmentStatus.CONFIRMED, notes: "Medium pressure, please." },
    { serviceIndex: 4, dayOffset: 3, hour: 14, status: AppointmentStatus.CANCELLED },
    { serviceIndex: 9, dayOffset: 5, hour: 15, status: AppointmentStatus.PENDING },
  ];

  for (const sample of samples) {
    const service = services[sample.serviceIndex];
    const startTime = zonedTimeToUtc(addDays(today, sample.dayOffset), sample.hour);
    await prisma.appointment.create({
      data: {
        userId,
        serviceId: service.id,
        startTime,
        endTime: addMinutes(startTime, service.durationMinutes),
        status: sample.status,
        notes: sample.notes,
      },
    });
  }
  console.log(`Created ${samples.length} demo appointments (COMPLETED, CONFIRMED, CANCELLED, PENDING)`);
}

async function main(): Promise<void> {
  await seedServices();
  const userId = await seedDemoUser();
  await seedDemoAppointments(userId);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
