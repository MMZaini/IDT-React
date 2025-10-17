"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
	checked?: boolean
	onCheckedChange?: (checked: boolean) => void
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
	({ className, checked = false, disabled, onCheckedChange, ...props }, ref) => {
		return (
			<button
				ref={ref}
				type="button"
				role="switch"
				aria-checked={checked}
				aria-disabled={disabled}
				data-state={checked ? "checked" : "unchecked"}
				disabled={disabled}
				onClick={() => !disabled && onCheckedChange?.(!checked)}
				className={cn(
					"relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors outline-none",
					disabled
						? "opacity-50 cursor-not-allowed bg-muted border-border"
						: checked
							? "bg-primary/90 border-primary"
							: "bg-input/60 border-input hover:bg-input",
					className
				)}
				{...props}
			>
				<span
					aria-hidden="true"
					className={cn(
						"pointer-events-none inline-block size-4 translate-x-0.5 transform rounded-full bg-background shadow transition-transform",
						checked ? "translate-x-[22px]" : "translate-x-0.5"
					)}
				/>
			</button>
		)
	}
)

Switch.displayName = "Switch"

export { Switch as default }

