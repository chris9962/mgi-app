import { StudentApp } from "@/components/student/StudentApp";

export default async function SchoolLink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentApp linkId={id} />;
}
