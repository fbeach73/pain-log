import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogClose 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const emailFormSchema = z.object({
  recipient: z.string().email("Please enter a valid email address"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().optional(),
});

type EmailFormValues = z.infer<typeof emailFormSchema>;

type EmailReportDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  reportName: string;
};

export default function EmailReportDialog({
  isOpen,
  onClose,
  reportId,
  reportName,
}: EmailReportDialogProps) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      recipient: "",
      subject: `Pain Report: ${reportName}`,
      message: "Here's the pain report you requested. This information can help track pain patterns over time.",
    },
  });

  const onSubmit = async (values: EmailFormValues) => {
    setIsSending(true);
    
    // In a production app, this would call an API endpoint to send the email
    // For now, we'll simulate sending with a timeout
    setTimeout(() => {
      setIsSending(false);
      toast({
        title: "Email Sent",
        description: `Report has been sent to ${values.recipient}`,
      });
      onClose();
    }, 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share Report via Email</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="recipient"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient Email</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="email@example.com" 
                      value={field.value || ""} 
                      onChange={field.onChange} 
                      onBlur={field.onBlur} 
                      name={field.name} 
                      ref={field.ref} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Email subject" 
                      value={field.value || ""} 
                      onChange={field.onChange} 
                      onBlur={field.onBlur} 
                      name={field.name} 
                      ref={field.ref} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add a message to accompany the report" 
                      className="resize-none" 
                      rows={3}
                      value={field.value || ""} 
                      onChange={field.onChange} 
                      onBlur={field.onBlur} 
                      name={field.name} 
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSending}>
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Send Email
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}