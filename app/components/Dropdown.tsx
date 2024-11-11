'use client';

import Select, { ClearIndicatorProps, GroupBase } from 'react-select';
import styles from 'components/Dropdown.module.css';
import CloseIcon from 'icons/close.svg';
import ExpandMoreIcon from 'icons/expand_more.svg';

type ReactDropdownProps = Parameters<Select>[0];

export type Props<Option> = {
  disabled?: ReactDropdownProps['isDisabled'];
  options: Array<SingleOption<Option>>;
} & Omit<ReactDropdownProps, 'isDisabled' | 'options'>;

export type SingleOption<Option> = {
  label: GroupBase<Option>['label'];
  value: Option;
};

const ClearIndicator = (
  { className: _, innerProps, ...__ }: ClearIndicatorProps, //@ts-ignore
) => <CloseIcon className="flex-shrink-0 h-4 w-4" {...innerProps} />;

const DropdownIndicator = () => (
  <ExpandMoreIcon className="flex-shrink-0 h-4 w-4" />
);

const Dropdown = <Option,>({
  disabled,
  options,
  className,
  ...rest
}: Props<Option>) => (
  <Select
    {...rest}
    className={`select-container ${className} ${styles['select-container']}`}
    classNamePrefix="_select"
    closeMenuOnSelect
    components={{
      ClearIndicator,
      DropdownIndicator,
      IndicatorSeparator: null,
    }}
    isDisabled={disabled}
    options={options}
    unstyled
  />
);

export default Dropdown;
