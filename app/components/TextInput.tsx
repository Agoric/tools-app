import React from 'react';

export type Props = React.InputHTMLAttributes<HTMLInputElement> &
  React.ClassAttributes<HTMLInputElement> & {
    setRef?: (ref: HTMLInputElement | null) => void;
  };

const TextInput = ({ className, setRef, ...props }: Props) => (
  <input
    {...props}
    className={`${className} no-outline p-4 w-full rounded h-9 font-normal text-xs text-gray-900`}
    ref={setRef}
  />
);

export default TextInput;
