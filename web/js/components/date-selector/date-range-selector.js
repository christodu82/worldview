import React from 'react';
import PropTypes from 'prop-types';
import DateSelector from './date-selector';

export default function DateRangeSelector (props) {
  const {
    startDate, endDate, setDateRange, minDate, maxDate, subDailyMode, idSuffix, isDisabled, mobileStyle,
  } = props;

  const setStartDate = (newStart) => {
    setDateRange([newStart, endDate]);
  };
  const setEndDate = (newEnd) => {
    setDateRange([startDate, newEnd]);
  };
  const className = isDisabled
    ? 'wv-date-range-selector disabled'
    : 'wv-date-range-selector';

  return (
    mobileStyle ? (
      <div className={className}>
        <div className="date-selector-row">
          <div className="date-selector-col">
            Start Date:
          </div>
          <DateSelector
            idSuffix={idSuffix}
            date={startDate}
            onDateChange={setStartDate}
            minDate={minDate}
            maxDate={endDate}
            subDailyMode={subDailyMode}
            isDisabled={isDisabled}
            isStartDate
          />
        </div>
        <div className="date-selector-row">
          <div className="date-selector-col">
            End Date:
          </div>
          <DateSelector
            idSuffix={idSuffix}
            date={endDate}
            onDateChange={setEndDate}
            maxDate={maxDate}
            minDate={startDate}
            subDailyMode={subDailyMode}
            isDisabled={isDisabled}
            isEndDate
          />
        </div>
      </div>
    )
      : (
        <div className={className}>
          <DateSelector
            idSuffix={idSuffix}
            date={startDate}
            onDateChange={setStartDate}
            minDate={minDate}
            maxDate={endDate}
            subDailyMode={subDailyMode}
            isDisabled={isDisabled}
            isStartDate
          />
          <div className="thru-label">to</div>
          <DateSelector
            idSuffix={idSuffix}
            date={endDate}
            onDateChange={setEndDate}
            maxDate={maxDate}
            minDate={startDate}
            subDailyMode={subDailyMode}
            isDisabled={isDisabled}
            isEndDate
          />
        </div>
      )
  );
}

DateRangeSelector.propTypes = {
  idSuffix: PropTypes.string,
  isDisabled: PropTypes.bool,
  startDate: PropTypes.object,
  endDate: PropTypes.object,
  setDateRange: PropTypes.func,
  minDate: PropTypes.object,
  maxDate: PropTypes.object,
  mobileStyle: PropTypes.bool,
  subDailyMode: PropTypes.bool,
};
