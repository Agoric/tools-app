'use client';

import styles from 'components/Dropdown.module.css';
// import CloseIcon from 'design-system/icons/navigation/close.svg?react';
// import ExpandMoreIcon from 'design-system/icons/navigation/expand_more.svg?react';
import Select, {
//   ClearIndicatorProps,
  GroupBase,
//   MultiValueProps,
} from 'react-select';

// const ClearIndicator = ({
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   className: _,
//   innerProps,
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   ...__
// }: ClearIndicatorProps) => (
//   <CloseIcon className='flex-shrink-0 h-4 w-4' {...innerProps} />
// );

// const DropdownIndicator = () => (
//   <ExpandMoreIcon className='flex-shrink-0 h-4 w-4' />
// );

// const MultiValue = ({
//   children,
//   removeProps,
//   // eslint-disable-next-line @typescript-eslint/no-unused-vars
//   innerProps: { className: _, ...innerProps } = {},
// }: MultiValueProps) => (
//   <div
//     className='bg-blue-50 flex items-center min-w-0 px-2 rounded-3xl'
//     {...innerProps}
//   >
//     <p className='design-body-small overflow-ellipsis overflow-hidden text-blue-1000 whitespace-nowrap'>
//       {children}
//     </p>
//     <CloseIcon
//       className='block design-body-small flex-shrink-0 h-3 text-blue-1000 w-3'
//       {...removeProps}
//     />
//   </div>
// );

type ReactDropdownProps = Parameters<Select>[0];

export type Props<Option> = {
  disabled?: ReactDropdownProps['isDisabled'];
  error?: boolean;
  options: Array<SingleOption<Option>>;
} & Omit<ReactDropdownProps, 'isDisabled' | 'options'>;

export type SingleOption<Option> = {
  label: GroupBase<Option>['label'];
  value: Option;
};

const Dropdown = <Option,>({
  disabled,
  options,
  error,
  className,
  ...rest
}: Props<Option>) => (
  <Select
    {...rest}
    className={`select-container ${className} ${styles['select-container']} ${
      error ? '!border-flame-red' : ''
    }`}
    classNamePrefix='_select'
    closeMenuOnSelect
    components={{
    //   ClearIndicator,
    //   DropdownIndicator,
      IndicatorSeparator: null,
    //   MultiValue: MultiValue,
    }}
    isDisabled={disabled}
    options={options}
    unstyled
  />
);

export default Dropdown;