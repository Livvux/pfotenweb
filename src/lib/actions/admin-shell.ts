"use server";
import { redirect } from "next/navigation";
import { requireAdmin, requireArea } from "../auth";
import { completeTour, markInquiriesSeen } from "../admin-notifications";
export async function openNewInquiries() { await markInquiriesSeen(await requireArea("inquiries")); redirect("/admin/anfragen?status=open"); }
export async function finishAdminTour() { await completeTour(await requireAdmin()); }
