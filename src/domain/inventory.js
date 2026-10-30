
import { DomainError } from "./errors.js";
import { newId, newReference } from "./ids.js";
import { Queue } from "./waitlistQueue.js";

export function createStore() {
  return {
    events: new Map(),
    bookings: new Map(),
    bookingsByReference: new Map(),
  };
}


export function createEvent(store, { name, date }) {
  if (!store || !(store.events instanceof Map)) {
    throw new DomainError("Invalid store", "VALIDATION");
  }

  if (typeof name !== "string" || name.trim() === "") {
    throw new DomainError("Event name is required", "VALIDATION");
  }

  if (typeof date !== "string" || date.trim() === "") {
    throw new DomainError("Event date is required", "VALIDATION");
  }

  const event = {
    id: newId(),
    name: name.trim(),
    date: date.trim(),
    tiers: new Map(),
  };

  store.events.set(event.id, event);

  return event;
}


export function addTier(store, eventId, { name, capacity, priceCents }) {
  if (!store || !(store.events instanceof Map)) {
    throw new DomainError("Invalid store", "VALIDATION");
  }

  const event = store.events.get(eventId);

  if (!event) {
    throw new DomainError("Event not found", "NOT_FOUND");
  }

  if (typeof name !== "string" || name.trim() === "") {
    throw new DomainError("Tier name is required", "VALIDATION");
  }

  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new DomainError(
      "Capacity must be a positive whole number",
      "VALIDATION"
    );
  }

  if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
    throw new DomainError(
      "Price must be a non-negative whole number",
      "VALIDATION"
    );
  }

  const tier = {
    id: newId(),
    name: name.trim(),
    capacity,
    available: capacity,
    priceCents,
    waitlist: new Queue(),
  };

  event.tiers.set(tier.id, tier);

  return tier;
}

export function bookTickets(store, eventId, tierId, { name, quantity }) {
  if (!store || !(store.events instanceof Map)) {
    throw new DomainError("Invalid store", "VALIDATION");
  }

  const event = store.events.get(eventId);

  if (!event) {
    throw new DomainError("Event not found", "NOT_FOUND");
  }

  const tier = event.tiers.get(tierId);

  if (!tier) {
    throw new DomainError("Ticket tier not found", "NOT_FOUND");
  }

  if (typeof name !== "string" || name.trim() === "") {
    throw new DomainError("Customer name is required", "VALIDATION");
  }

  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new DomainError(
      "Quantity must be a whole number between 1 and 10",
      "VALIDATION"
    );
  }

  if (tier.available < quantity) {
    throw new DomainError("Not enough tickets available", "SOLD_OUT");
  }

  const booking = {
    id: newId(),
    reference: newReference(),
    eventId,
    tierId,
    name: name.trim(),
    quantity,
    totalPriceInCents: tier.priceCents * quantity,
    status: "CONFIRMED",
  };

  tier.available -= quantity;

  store.bookings.set(booking.id, booking);
  store.bookingsByReference.set(booking.reference, booking);

  return booking;
}

export function findBookingByReference(store, reference) {
  if (!store || !(store.bookingsByReference instanceof Map)) {
    throw new DomainError("Invalid store", "VALIDATION");
  }

  if (typeof reference !== "string" || reference.trim() === "") {
    throw new DomainError("Booking reference is required", "VALIDATION");
  }

  const booking = store.bookingsByReference.get(reference.trim());

  if (!booking) {
    throw new DomainError("Booking not found", "NOT_FOUND");
  }

  return booking;
}

export function cancelBooking(store, reference) {
  if (!store || !(store.bookingsByReference instanceof Map)) {
    throw new DomainError("Invalid store", "VALIDATION");
  }

  if (typeof reference !== "string" || reference.trim() === "") {
    throw new DomainError("Booking reference is required", "VALIDATION");
  }

  const booking = store.bookingsByReference.get(reference.trim());

  if (!booking) {
    throw new DomainError("Booking not found", "NOT_FOUND");
  }

  if (booking.status === "CANCELLED") {
    throw new DomainError("Booking is already cancelled", "VALIDATION");
  }

  const event = store.events.get(booking.eventId);
  const tier = event?.tiers.get(booking.tierId);

  if (!tier) {
    throw new DomainError("Ticket tier not found", "NOT_FOUND");
  }

  tier.available += booking.quantity;
  booking.status = "CANCELLED";

  const nextPerson = tier.waitlist.peek();

  return {
    booking,
    nextPerson,
  };
}

export function joinWaitlist(store, eventId, tierId, { name, quantity }) {
  if (!store || !(store.events instanceof Map)) {
    throw new DomainError("Invalid store", "VALIDATION");
  }

  const event = store.events.get(eventId);

  if (!event) {
    throw new DomainError("Event not found", "NOT_FOUND");
  }

  const tier = event.tiers.get(tierId);

  if (!tier) {
    throw new DomainError("Ticket tier not found", "NOT_FOUND");
  }

  if (typeof name !== "string" || name.trim() === "") {
    throw new DomainError("Customer name is required", "VALIDATION");
  }

  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new DomainError(
      "Quantity must be a whole number between 1 and 10",
      "VALIDATION"
    );
  }

  if (tier.available >= quantity) {
    throw new DomainError(
      "Tickets are still available for this quantity",
      "VALIDATION"
    );
  }

  const entry = {
    id: newId(),
    name: name.trim(),
    quantity,
    eventId,
    tierId,
    joinedAt: new Date().toISOString(),
  };

  tier.waitlist.enqueue(entry);

  return entry;
}