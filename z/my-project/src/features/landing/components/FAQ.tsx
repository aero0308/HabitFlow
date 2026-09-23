"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { faqs } from "../data/faqs";
import {
  fadeInUp,
  staggerContainer,
  viewportOnce,
} from "../animations";

export function FAQ() {
  return (
    <section
      id="faq"
      className="py-20 md:py-28 bg-muted/30 border-y border-border/50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center max-w-2xl mx-auto mb-12 md:mb-16"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <motion.h2
            variants={fadeInUp}
            className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4 leading-[1.1]"
          >
            Frequently asked questions
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-base sm:text-lg text-muted-foreground leading-relaxed"
          >
            Everything you need to know.
          </motion.p>
        </motion.div>

        <motion.div
          className="max-w-3xl mx-auto"
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <Accordion
            type="single"
            collapsible
            className="bg-card rounded-2xl border border-border/50 px-6"
          >
            {faqs.map((faq, idx) => (
              <AccordionItem
                key={faq.question}
                value={`item-${idx}`}
                className={idx === 0 ? "border-b" : "border-b last:border-b-0"}
              >
                <AccordionTrigger className="font-medium text-foreground text-base md:text-lg hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
