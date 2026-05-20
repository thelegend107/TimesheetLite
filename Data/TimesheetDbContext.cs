using Microsoft.EntityFrameworkCore;

namespace TimesheetLite.Data;

public class TimesheetDbContext(DbContextOptions<TimesheetDbContext> options) : DbContext(options)
{
    public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<TimeEntry>(entity =>
        {
            entity.ToTable("TimeEntry", "dbo");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.WorkDate)
                .HasColumnType("date");

            entity.Property(x => x.Project)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.Task)
                .HasMaxLength(100);

            entity.Property(x => x.Hours)
                .HasPrecision(5, 2);

            entity.Property(x => x.Notes)
                .HasMaxLength(1000);

            entity.Property(x => x.CreatedDate)
                .HasDefaultValueSql("SYSDATETIMEOFFSET()");

            entity.Property(x => x.UpdatedDate)
                .HasDefaultValueSql("SYSDATETIMEOFFSET()");

            entity.HasIndex(x => x.WorkDate)
                .HasDatabaseName("IX_TimeEntry_WorkDate");

            entity.HasIndex(x => new { x.Project, x.WorkDate })
                .HasDatabaseName("IX_TimeEntry_Project_WorkDate");
        });
    }
}
