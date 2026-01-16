import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  itemName?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  itemName = 'items',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = (isMobile: boolean = false) => {
    const pages: (number | string)[] = [];
    const maxVisible = isMobile ? 3 : 7;

    if (totalPages <= maxVisible) {
      // Show all pages if total pages is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (isMobile) {
        // Mobile: Show current page and neighbors only
        if (currentPage === 1) {
          pages.push(1, 2);
          if (totalPages > 2) pages.push('ellipsis', totalPages);
        } else if (currentPage === totalPages) {
          pages.push(1, 'ellipsis', totalPages - 1, totalPages);
        } else {
          pages.push(1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1);
          if (currentPage + 1 < totalPages) {
            pages.push('ellipsis', totalPages);
          }
        }
      } else {
        // Desktop: Show more pages
        // Always show first page
        pages.push(1);

        if (currentPage <= 3) {
          // Near the start
          for (let i = 2; i <= 4; i++) {
            pages.push(i);
          }
          pages.push('ellipsis');
          pages.push(totalPages);
        } else if (currentPage >= totalPages - 2) {
          // Near the end
          pages.push('ellipsis');
          for (let i = totalPages - 3; i <= totalPages; i++) {
            pages.push(i);
          }
        } else {
          // In the middle
          pages.push('ellipsis');
          for (let i = currentPage - 1; i <= currentPage + 1; i++) {
            pages.push(i);
          }
          pages.push('ellipsis');
          pages.push(totalPages);
        }
      }
    }

    return pages;
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
        Showing {startItem} to {endItem} of {totalItems} {itemName}
      </p>
      <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex-1 sm:flex-initial"
        >
          <ChevronLeft className="h-4 w-4 sm:mr-0" />
          <span className="hidden sm:inline ml-1">Previous</span>
        </Button>

        {/* Desktop page numbers */}
        <div className="hidden md:flex items-center gap-1">
          {getPageNumbers(false).map((page, index) => {
            if (page === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-sm text-muted-foreground"
                >
                  ...
                </span>
              );
            }

            const pageNum = page as number;
            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className="min-w-[2.5rem]"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>

        {/* Mobile page numbers - simplified */}
        <div className="flex md:hidden items-center gap-1">
          {getPageNumbers(true).map((page, index) => {
            if (page === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-1 text-xs text-muted-foreground"
                >
                  ...
                </span>
              );
            }

            const pageNum = page as number;
            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className="min-w-[2rem] h-8 text-xs"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex-1 sm:flex-initial"
        >
          <span className="hidden sm:inline mr-1">Next</span>
          <ChevronRight className="h-4 w-4 sm:ml-0" />
        </Button>
      </div>
    </div>
  );
}

