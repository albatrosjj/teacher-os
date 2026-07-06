import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        TeacherOS
      </h1>
      <p className="text-muted-foreground max-w-md text-lg">
        AI-assisted grading for classic written exams. Foundation is ready —
        features coming soon.
      </p>
      <Button size="lg">Get started</Button>
    </main>
  );
}
