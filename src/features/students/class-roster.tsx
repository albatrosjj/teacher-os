import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { Student } from "./types";

export function ClassRoster({
  className,
  students,
}: {
  className: string;
  students: Student[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{className}</CardTitle>
        <CardDescription>
          {students.length} student{students.length === 1 ? "" : "s"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-border divide-y">
          {students.map((student) => (
            <li key={student.id}>
              <Link
                href={`/students/${student.id}`}
                className="hover:bg-muted -mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors"
              >
                <span className="text-muted-foreground w-12 shrink-0 font-mono text-sm tabular-nums">
                  #{student.student_number}
                </span>
                <span>
                  {student.first_name} {student.last_name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
