"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { showToast } from "@/lib/toast";
import { Loader2 } from "lucide-react";

const profileSchema = z.object({
  displayName: z
    .string()
    .min(2, "Navnet må være minst 2 tegn")
    .max(50, "Navnet kan ikke være lengre enn 50 tegn"),
  email: z.string().email(),
  bio: z.string().max(300, "Bio kan ikke være lengre enn 300 tegn").optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function InnstillingerPage() {
  const { user } = useAuth();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.displayName || "",
      email: user?.email || "",
      bio: "",
    },
  });

  async function onSubmit(data: ProfileFormValues) {
    // Simuler lagring
    await new Promise((r) => setTimeout(r, 1000));
    showToast.success(`Profil oppdatert for ${data.displayName}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Innstillinger</h1>
        <p className="text-muted-foreground">
          Administrer profil og kontoinnstillinger.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>
            Oppdater visningsnavn og annen profilinformasjon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visningsnavn</FormLabel>
                    <FormControl>
                      <Input placeholder="Ditt navn" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-post</FormLabel>
                    <FormControl>
                      <Input {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Skriv litt om deg selv..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Lagre endringer
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
