IF OBJECT_ID(N'[dbo].[vTimeEntryWeeklySummary]', N'V') IS NOT NULL
    DROP VIEW [dbo].[vTimeEntryWeeklySummary];
GO

IF OBJECT_ID(N'[dbo].[TimeEntry]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TimeEntry]
    (
        [Id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_TimeEntry] PRIMARY KEY CLUSTERED,
        [WorkDate] DATE NOT NULL,
        [Project] NVARCHAR(100) NOT NULL,
        [Task] NVARCHAR(100) NULL,
        [Hours] DECIMAL(5,2) NOT NULL,
        [Notes] NVARCHAR(1000) NULL,
        [CreatedDate] DATETIMEOFFSET NOT NULL CONSTRAINT [DF_TimeEntry_CreatedDate] DEFAULT SYSDATETIMEOFFSET(),
        [UpdatedDate] DATETIMEOFFSET NOT NULL CONSTRAINT [DF_TimeEntry_UpdatedDate] DEFAULT SYSDATETIMEOFFSET(),

        CONSTRAINT [CK_TimeEntry_Hours] CHECK ([Hours] > 0 AND [Hours] <= 24)
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM [sys].[indexes]
    WHERE [name] = N'IX_TimeEntry_WorkDate'
      AND [object_id] = OBJECT_ID(N'[dbo].[TimeEntry]')
)
BEGIN
    CREATE INDEX [IX_TimeEntry_WorkDate]
    ON [dbo].[TimeEntry] ([WorkDate]);
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM [sys].[indexes]
    WHERE [name] = N'IX_TimeEntry_Project_WorkDate'
      AND [object_id] = OBJECT_ID(N'[dbo].[TimeEntry]')
)
BEGIN
    CREATE INDEX [IX_TimeEntry_Project_WorkDate]
    ON [dbo].[TimeEntry] ([Project], [WorkDate]);
END;
GO

CREATE VIEW [dbo].[vTimeEntryWeeklySummary]
AS
SELECT
    CAST(DATEADD(DAY, -DATEDIFF(DAY, 0, [WorkDate]) % 7, [WorkDate]) AS DATE) AS [WeekStart],
    [Project],
    SUM([Hours]) AS [TotalHours]
FROM [dbo].[TimeEntry]
GROUP BY
    CAST(DATEADD(DAY, -DATEDIFF(DAY, 0, [WorkDate]) % 7, [WorkDate]) AS DATE),
    [Project];
GO
