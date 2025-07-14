import { useState, useEffect } from 'react';
import { View, Views } from 'react-big-calendar';

const useResponsiveCalendar = () => {
  const [calendarView, setCalendarView] = useState<View>(Views.WEEK);
  useEffect(() => {
    const checkView = () => {
      if (window.matchMedia('(max-width: 768px)').matches) {
        setCalendarView(Views.DAY);
      } else {
        setCalendarView(Views.WEEK);
      }
    };
    checkView();
    window.addEventListener('resize', checkView);
    return () => window.removeEventListener('resize', checkView);
  }, []);

  return { calendarView, setCalendarView };
};

export default useResponsiveCalendar;
